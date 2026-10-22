// Run: node --test package/tests/hydration-discovery.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;

// Small DOM doubles: selectors stay within a tree and do not pierce shadow roots
// or template contents. Rendering is checked via the unchanged template passed
// to Bay's create API; these tests do not simulate the browser renderer.
class Tree {
  children = [];
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (child.matches(selector)) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  getRootNode() { return this.parentNode ? this.parentNode.getRootNode() : this; }
}
class Element extends Tree {
  attributes = new Map();
  constructor(tagName = 'div') { super(); this.tagName = tagName; }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(value) { this.setAttribute('id', value); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  matches(selector) {
    return selector.startsWith('#') ? this.id === selector.slice(1) :
      selector.startsWith('[') ? this.hasAttribute(selector.slice(1, -1)) : this.tagName === selector;
  }
}

function target(root, html = '<p>${this.message}</p>') {
  const element = root.appendChild(new Element());
  element.setAttribute('bay-hydrate', '');
  if (html !== null) {
    const template = element.appendChild(new Element('template'));
    template.innerHTML = html;
  }
  return element;
}

function harness() {
  const document = new Tree();
  document.nodeType = 9;
  document.readyState = 'loading';
  document.body = document.appendChild(new Element('body'));
  document.createElement = name => new Element(name);
  const definitions = new Map();
  const created = [], fetched = [];
  let onCreate = () => {};
  const bay = {};
  const window = { bay: {}, addEventListener() {} };
  const context = vm.createContext({
    document, Element, bay, window, customElements: { get: name => definitions.get(name) },
    $: (root, selector) => root.querySelectorAll(selector),
    to_fetch: [], already_fetched: [],
    fetch_component: element => fetched.push(element),
    create_template_fn(name, html) {
      created.push({ name, html });
      onCreate();
      definitions.set(name, true);
    },
  });
  const functionStart = source.indexOf('function get_all_bays(');
  const stateStart = source.lastIndexOf('const hydrated_targets', functionStart);
  const end = source.indexOf('function apply_settings(', functionStart);
  assert.ok(functionStart >= 0 && end > functionStart);
  vm.runInContext(source.slice(stateStart < 0 ? functionStart : stateStart, end), context);
  // Exercise the actual refresh API and initialization order, not a copied scan.
  const initStart = source.indexOf('  bay.refresh =');
  const initEnd = source.indexOf('\n};', initStart);
  vm.runInContext(source.slice(initStart, initEnd), context);
  return {
    document, created, fetched, definitions,
    refresh: () => bay.refresh(), scan: root => context.get_all_bays(root),
    onCreate(callback) { onCreate = callback; },
    resolveController(controller) {
      // Exercise the real constructor's target-selection branch as well.
      const start = source.indexOf('const inner_el = this.getAttribute("inner-html")');
      const end = source.indexOf('this.addManagedListener(document, "securitypolicyviolation"', start);
      assert.ok(start >= 0 && end > start);
      context.controller = controller;
      vm.runInContext('(function(){' + source.slice(start, end) + '}).call(controller)', context);
      return controller.inner_el;
    },
  };
}

test('B5: repeated and reentrant refresh creates one controller before and after template removal', () => {
  const h = harness();
  const element = target(h.document.body);
  let reentered = false;
  h.onCreate(() => { if (!reentered) { reentered = true; h.scan(h.document); } });
  h.refresh(); h.refresh();
  const id = element.id;
  assert.equal(h.created.length, 1);
  assert.equal(h.created[0].html, '<inner-html><p>${this.message}</p></inner-html>');
  const controller = h.document.body.children.find(child => child.hasAttribute('inner-html'));
  assert.equal(controller.getAttribute('inner-html'), '#' + id);
  assert.equal(h.resolveController(controller), element);
  element.children = []; // light-DOM rendering removes the original template
  assert.doesNotThrow(() => h.refresh());
  assert.equal(h.created.length, 1);
  assert.equal(element.id, id);
  assert.equal(h.document.body.children.filter(child => child.hasAttribute('inner-html')).length, 1);
});

test('B5: missing templates are skipped without blocking other discovery or a later template', () => {
  const h = harness();
  const element = target(h.document.body, null);
  const regular = h.document.body.appendChild(new Element('ordinary-component'));
  regular.setAttribute('bay', '/ordinary.html');
  assert.doesNotThrow(() => h.refresh());
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.fetched, [regular]);
  const template = element.appendChild(new Element('template'));
  template.innerHTML = '<p>added later</p>';
  h.refresh();
  assert.equal(h.created.length, 1);
  assert.equal(h.created[0].html, '<inner-html><p>added later</p></inner-html>');
});

test('B5: shadow and nested discovery stay scoped and controllers bind to the actual target', () => {
  const h = harness();
  const outside = target(h.document.body);
  const shadow = new Tree();
  const inner = target(shadow);
  h.scan(shadow);
  assert.equal(outside.id, '');
  assert.equal(h.created.length, 1);
  const controller = shadow.children.find(child => child.hasAttribute('inner-html'));
  assert.ok(controller, 'controller must be in the target tree');
  assert.equal(h.resolveController(controller), inner);
  inner.children = [];
  const nested = target(inner, '<p>nested</p>');
  h.scan(inner); h.scan(shadow);
  assert.equal(h.created.length, 2);
  assert.notEqual(inner.id, nested.id);
  assert.equal(outside.id, '');
  const self = target(shadow, '<p>root target</p>');
  h.scan(self); // an Element supplied as root may itself be a hydration target
  assert.equal(h.created.length, 3);
});

test('B5: newly discovered targets get unique names without renumbering existing targets', () => {
  const h = harness();
  const occupied = h.document.body.appendChild(new Element());
  occupied.id = 'bay-hydrate-0';
  h.definitions.set('bay-hydrate-1', true);
  const first = target(h.document.body);
  h.refresh();
  const originalId = first.id;
  const second = target(h.document.body);
  h.refresh();
  assert.notEqual(first.id, occupied.id);
  assert.notEqual(first.id, 'bay-hydrate-1');
  assert.notEqual(first.id, second.id);
  assert.equal(first.id, originalId);
  assert.equal(h.created.length, 2);
  assert.equal(new Set(h.created.map(entry => entry.name)).size, 2);
});
