// Run: node --test package/tests/refs.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;
const start = source.indexOf('this.shadowDom.refs =');
const end = source.indexOf('this.shadowDom.uniqid =', start);
assert.ok(start >= 0 && end > start);
// Limit extraction to the actual refs assignment, before constructor setup.
const refs = source.slice(start, end).match(/^[\s\S]*?\n\s*};/)[0];

// Minimal trees with browser-style shadow boundaries. Component roots carry
// the same $el ownership marker as Bay's real controller; no browser rendering.
class Root {
  children = [];
  append(el) { el.parentElement = this instanceof Element ? this : null; this.children.push(el); return el; }
  querySelectorAll(selector) {
    const result = [];
    for (const el of this.children) {
      if (selector === '[ref]' ? el.hasAttribute('ref') : selector === `[ref="${el.getAttribute('ref')}"]`) result.push(el);
      result.push(...el.querySelectorAll(selector));
    }
    return result;
  }
}
class Element extends Root {
  attributes = new Map();
  parentElement = null;
  constructor(tag = 'div') { super(); this.tagName = tag; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
}

function harness() {
  const document = new Root();
  document.createElement = tag => new Element(tag);
  const context = vm.createContext({ document, element_name: '$el' });
  return {
    document,
    component(parent = document, tag = 'example-card', inner) {
      const host = parent.append(new Element(tag));
      host.shadowDom = new Root(); host.shadowDom.$el = host;
      host.inner_el = inner ?? host;
      context.host = host;
      vm.runInContext('(function(){' + refs + '}).call(host)', context);
      return host;
    },
    ref(parent, name = 'label') {
      const el = parent.append(new Element()); el.setAttribute('ref', name); return el;
    },
  };
}

test('B14: same-tag instances cannot expose each other or unrelated document refs', () => {
  const h = harness(), a = h.component(), b = h.component();
  const own = h.ref(a), sibling = h.ref(b), outside = h.ref(h.document);
  const lookalike = h.document.append(new Element()); lookalike.setAttribute('id', 'example-card');
  h.ref(lookalike);
  assert.equal(a.shadowDom.refs('label'), own);
  assert.equal(b.shadowDom.refs('label'), sibling);
  assert.notEqual(a.shadowDom.refs('label'), outside);
});

test('B14: shadow and light refs retain single-element and array return types', () => {
  const h = harness(), host = h.component();
  const shadow = h.ref(host.shadowDom, 'shadow'), light = h.ref(host, 'light');
  assert.equal(host.shadowDom.refs('shadow'), shadow);
  assert.equal(host.shadowDom.refs('light'), light);
  const first = h.ref(host.shadowDom), second = h.ref(host.shadowDom), third = h.ref(host);
  const result = host.shadowDom.refs('label');
  assert.equal(Array.isArray(result), true);
  assert.deepEqual([...result], [first, second, third]);
});

test('B14: nested components own their light and shadow descendants, while host refs belong to the parent', () => {
  const h = harness(), parent = h.component();
  for (const root of [parent, parent.shadowDom]) {
    const wrapper = root.append(new Element('section'));
    const child = h.component(wrapper, 'child-card'); child.setAttribute('ref', 'child');
    const light = h.ref(child, 'internal'), shadow = h.ref(child.shadowDom, 'internal');
    const grandchild = h.component(child); h.ref(grandchild, 'internal');
    assert.deepEqual([...child.shadowDom.refs('internal')], [shadow, light]);
    assert.equal(parent.shadowDom.refs('internal').tagName, 'error');
  }
  const hosts = parent.shadowDom.refs('child');
  assert.equal(hosts.length, 2);
  assert.ok(hosts.every(el => el.tagName === 'child-card'));
});

test('B14: nested same-tag components remain separate', () => {
  const h = harness(), parent = h.component(), child = h.component(parent);
  const own = h.ref(parent), nested = h.ref(child);
  assert.equal(parent.shadowDom.refs('label'), own);
  assert.equal(child.shadowDom.refs('label'), nested);
});

test('B14: explicit inner-html roots remain supported without overlap duplicates', () => {
  const h = harness(), host = h.component();
  host.inner_el = host.append(new Element('section'));
  const shared = h.ref(host.inner_el);
  assert.equal(host.shadowDom.refs('label'), shared, 'overlapping host/inner roots return one element');
  const external = h.document.append(new Element('section'));
  host.inner_el = external;
  const rendered = h.ref(external), nested = h.component(external); h.ref(nested);
  assert.deepEqual([...host.shadowDom.refs('label')], [shared, rendered]);
});

test('B14: missing refs retain the error element contract, and lookups reflect subsequent DOM changes', () => {
  const h = harness(), host = h.component();
  const error = host.shadowDom.refs('missing');
  assert.equal(error.tagName, 'error');
  assert.equal(error.innerHTML, '$refs("missing") not mounted"');
  const added = h.ref(host.shadowDom, 'missing');
  assert.equal(host.shadowDom.refs('missing'), added);
  host.shadowDom.children = [];
  assert.equal(host.shadowDom.refs('missing').tagName, 'error');
});

test('B14: ref names are matched literally rather than interpreted as selectors', () => {
  const h = harness(), host = h.component();
  const name = 'quoted" [ref="other';
  const exact = h.ref(host.shadowDom, name); h.ref(host.shadowDom, 'other');
  assert.equal(host.shadowDom.refs(name), exact);
});
