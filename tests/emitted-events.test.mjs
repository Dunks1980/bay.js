// Run: node --test package/tests/emitted-events.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;

// Native EventTargets exercise dispatch and listener identity. Selector doubles
// model overlapping light/shadow roots; this is not a browser rendering test.
class Root {
  targets = [];
  querySelectorAll(selector) { return this.targets.filter(el => el.selector === selector); }
}
class ShadowRoot extends Root {
  constructor(host) { super(); this.host = host; }
}
class Window extends EventTarget {
  bay = {};
  relayAdds = 0;
  addEventListener(name, listener, options) {
    if (name === 'bay_emit') this.relayAdds++;
    super.addEventListener(name, listener, options);
  }
}

function harness() {
  const window = new Window(), document = new Root();
  const context = vm.createContext({
    window, document, ShadowRoot, CustomEvent, data_attr: 'data-bay-',
    $: (root, selector) => root.querySelectorAll(selector),
  });
  const start = source.indexOf('function emit('), end = source.indexOf('function make_map_proxy', start);
  assert.ok(start >= 0 && end > start);
  // Includes the real runtime relay initialization, if present.
  vm.runInContext(source.slice(start, end), context);
  let index = 0;
  return {
    window, document,
    target(root, name = 'message') {
      const el = new EventTarget();
      el.selector = `[data-bay-${name}]`;
      el.received = [];
      el.addEventListener(name, event => el.received.push(event));
      root.targets.push(el);
      return el;
    },
    mount() {
      const host = new Root(); host.isConnected = true;
      const root = new ShadowRoot(host), uniqid = 'test' + index++;
      window.bay[uniqid] = root;
      context.instance = { uniqid };
      // Execute the constructor's actual emit setup, then its generated prefix.
      const start = source.indexOf('window.bay[this.uniqid].emit = window.bay.emit');
      const end = source.indexOf('this.prefixes =', start);
      assert.ok(start >= 0 && end > start);
      vm.runInContext('(function(){let on_var="";' + source.slice(start, end) +
        'this.emitPrefix=emit_var;}).call(instance)', context);
      context.root = root; context.host = host;
      vm.runInContext('(function($bay,$el){' + context.instance.emitPrefix + '})(root,host)', context);
      return { root, host };
    },
    emit: (name = 'message', data = {}) => window.bay.emit(name, data),
  };
}

test('B12: multiple instances deliver once to each document, light and shadow target', () => {
  const h = harness();
  const first = h.mount(), second = h.mount(), third = h.mount();
  const doc = h.target(h.document);
  const light = h.target(h.document); first.host.targets.push(light);
  const shadow = h.target(first.root), nestedShadow = h.target(second.root);
  // A light child of a nested component is also visible in its parent's root.
  const nestedLight = h.target(first.root); second.host.targets.push(nestedLight);
  const otherShadow = h.target(third.root);
  h.emit();
  for (const el of [doc, light, shadow, nestedShadow, nestedLight, otherShadow]) {
    assert.equal(el.received.length, 1);
  }
});

test('B12: direct receive deduplicates identical and overlapping roots', () => {
  const h = harness(), component = h.mount();
  const el = h.target(h.document); component.root.targets.push(el); component.host.targets.push(el);
  const data = { value: 42 };
  h.window.bay.receive(component.root, component.host, 'message', data);
  assert.equal(el.received.length, 1);
  assert.equal(el.received[0].detail.data, data);
  h.window.bay.receive(component.root, component.root, 'message', data);
  assert.equal(el.received.length, 2);
});

test('B12: repeated emits and named global subscribers remain independent with unchanged payloads and flags', () => {
  const h = harness(), component = h.mount(), el = h.target(component.root);
  const named = [], relay = [];
  h.window.addEventListener('message', event => named.push(event));
  h.window.addEventListener('bay_emit', event => relay.push(event));
  const data = { value: 'same object' };
  h.emit('message', data); h.emit('message', data);
  assert.equal(el.received.length, 2);
  assert.equal(named.length, 2); assert.equal(relay.length, 2);
  for (const event of [...el.received, ...named, ...relay]) {
    assert.equal(event.detail.name, 'message'); assert.equal(event.detail.data, data);
    assert.equal(event.bubbles, false); assert.equal(event.composed, false);
    assert.equal(event.cancelable, false);
  }
});

test('B12: removal skips shadow recipients, reconnection restores delivery without more relays', () => {
  const h = harness(), component = h.mount(), el = h.target(component.root);
  const documentTarget = h.target(h.document);
  h.emit(); component.host.isConnected = false; h.emit();
  assert.equal(el.received.length, 1);
  assert.equal(documentTarget.received.length, 2);
  component.host.isConnected = true; h.emit();
  assert.equal(el.received.length, 2);
  assert.equal(documentTarget.received.length, 3);
  for (let i = 0; i < 5; i++) h.mount();
  assert.equal(h.window.relayAdds, 1);
});

test('B12: document targets receive once even with no components, and different names stay distinct', () => {
  const h = harness(), first = h.target(h.document), second = h.target(h.document, 'other');
  h.emit(); h.emit('other', 0); h.emit('message', null);
  assert.equal(first.received.length, 2); assert.equal(second.received.length, 1);
  assert.equal(first.received[1].detail.data, null);
  assert.equal(second.received[0].detail.data, 0);
});
