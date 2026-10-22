// Run: node --test package/tests/once-events.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;

// Native EventTarget supplies listener dispatch and once removal. The attribute
// adapter preserves Attr identity on setAttribute, as the browser DOM does.
// These are binding tests, not browser rendering or Blob-import tests.
class Element extends EventTarget {
  attributes = [];
  options = [];
  closest() { return this; }
  setAttribute(name, value) {
    const existing = this.attributes.find(attr => attr.name === name);
    if (existing) existing.value = value;
    else this.attributes.push({ name, value });
  }
  removeAttribute(name) { this.attributes = this.attributes.filter(attr => attr.name !== name); }
  addEventListener(name, listener, options) {
    this.options.push({ name, ...options });
    super.addEventListener(name, listener, options);
  }
}

function harness() {
  const state = { count: 0, other: 0 };
  const component = { proxy: state };
  const ref = { uniqid: 'test', eventHandlers: new Map(), oldEvents: '' };
  const context = vm.createContext({
    window: { bay: { test: component } }, local_name: '$bay', data_attr: 'data-bay-',
    addBlob_event(_ref, text) {
      vm.runInContext('(function($bay){' + text +
        '}).call(window.bay.test.proxy,window.bay.test)', context);
    },
  });
  function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
  }
  vm.runInContext(section('const modifiers_array =', '(function attachShadowRoots') +
    section('function add_events(', 'function set_styles(') +
    section('function apply_events(', 'function render_debouncer('), context);
  return {
    state, ref,
    element(name = ':click.once', expression = 'this.count++') {
      const el = new Element(); el.setAttribute(name, expression); return el;
    },
    render(elements) { context.add_events(ref, elements, '', '', 'data-test'); },
    fire(el, type = 'click', props = {}) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, props); el.dispatchEvent(event); return event;
    },
  };
}

test('B11: once is consumed across repeated renders of the same element and directive', () => {
  const h = harness(), el = h.element();
  h.render([el]); h.render([el]);
  h.fire(el); h.fire(el);
  assert.equal(h.state.count, 1);
  for (let i = 0; i < 5; i++) { h.render([el]); h.fire(el); }
  assert.equal(h.state.count, 1);
  // Source/value edits alone do not remove the directive.
  el.setAttribute(':click.once', 'this.other++'); h.render([el]); h.fire(el);
  assert.equal(h.state.other, 0);
});

test('B11: newly created elements get fresh once listeners even at a reused index', () => {
  const h = harness(), first = h.element();
  h.render([first]); h.fire(first);
  h.render([]);
  const next = h.element(); h.render([next]); h.fire(next); h.fire(next);
  h.render([next]); h.fire(next);
  assert.equal(h.state.count, 2);
});

test('B11: removal and recreation resets once, including between renders', () => {
  for (const renderWhileRemoved of [false, true]) {
    const h = harness(), el = h.element();
    h.render([el]); h.fire(el);
    el.removeAttribute(':click.once');
    if (renderWhileRemoved) h.render([el]);
    el.setAttribute(':click.once', 'this.count++');
    h.render([el]); h.fire(el); h.fire(el);
    h.render([el]); h.fire(el);
    assert.equal(h.state.count, 2);
  }
});

test('B11: index changes before or after consumption cannot reactivate once', () => {
  const h = harness(), el = h.element(), sibling = new Element();
  h.render([el]); h.render([sibling, el]);
  h.fire(el);
  assert.equal(h.state.count, 1, 'stale listeners at previous indexes must not double-dispatch');
  h.render([el]); h.fire(el);
  h.render([sibling, el]); h.fire(el);
  assert.equal(h.state.count, 1);
});

test('B11: consumption is recorded before a handler triggers a render and nested event', () => {
  const h = harness(), el = h.element(':click.once', 'this.submit()');
  h.state.submit = () => { h.state.count++; h.render([el]); h.fire(el); };
  h.render([el]); h.fire(el);
  assert.equal(h.state.count, 1);
});

test('B11: ordinary listeners and keyboard, prevent, stop, capture and passive modifiers remain active', () => {
  const h = harness();
  const el = h.element(':keydown.enter.ctrl.prevent.stop.capture', 'this.count++');
  const passive = h.element('data-bay-click.passive', 'this.other++');
  for (let i = 0; i < 3; i++) {
    h.render([el, passive]);
    const ignored = h.fire(el, 'keydown', { key: 'Escape', ctrlKey: true });
    assert.equal(ignored.defaultPrevented, true, 'preserve prevent running before key filters');
    const event = h.fire(el, 'keydown', { key: 'Enter', ctrlKey: true });
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.cancelBubble, true);
    h.fire(passive);
  }
  assert.equal(h.state.count, 3); assert.equal(h.state.other, 3);
  assert.ok(el.options.every(options => options.name === 'keydown' && options.capture));
  assert.ok(passive.options.every(options => options.name === 'click' && options.passive));
});

test('B11: once retains native first-event semantics when combined with a key filter', () => {
  const h = harness(), el = h.element('data-bay-keydown.once.enter');
  h.render([el]); h.fire(el, 'keydown', { key: 'Escape' });
  h.render([el]); h.fire(el, 'keydown', { key: 'Enter' });
  assert.equal(h.state.count, 0, 'the first event consumes once even when its handler filter returns');
});
