// Run: node --test package/tests/lifecycle-discovery.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../bay.mts', import.meta.url), 'utf8');

test('B10: props and slotchange hooks remain independently subscribed', () => {
  const start = source.indexOf('let update_func =');
  const end = source.indexOf('// add decode & encode functions', start);
  assert.ok(start >= 0 && end > start);
  const instance = { tmp: '/*props updates*/ /*slotchange updates*/' };
  vm.runInNewContext(source.slice(start, end) +
    '\nthis.prefix = update_func + slotchange_func;', instance);

  const listeners = new Map();
  const calls = { props: 0, slotchange: 0, details: null };
  vm.runInNewContext('"use strict";\n' + instance.prefix + `
    $props = () => calls.props++;
    $slotchange = event => { calls.slotchange++; calls.details = event.detail; };
  `, {
    window: { addEventListener: (name, listener) => listeners.set(name, listener) },
    $el: { addManagedListener: (_target, name, listener) => listeners.set(name, listener) },
    $bay_uniqid: 'test-component', calls,
  });
  assert.equal(listeners.size, 2);
  assert.equal(typeof listeners.get('bay_local_update_event_test-component'), 'function');
  assert.equal(typeof listeners.get('bay_slotchange_event_test-component'), 'function');
  listeners.get('bay_local_update_event_test-component')();
  const detail = { changed: 'slotchange' };
  listeners.get('bay_slotchange_event_test-component')({ detail });
  assert.deepEqual(calls, { props: 1, slotchange: 1, details: detail });
});

test('B15: discovery runs after load or immediately when already complete, with APIs ready', () => {
  const start = source.lastIndexOf('// ------------------------------');
  const end = source.lastIndexOf('\n};');
  assert.ok(start >= 0 && end > start);
  const initialization = source.slice(start, end);

  for (const readyState of ['loading', 'interactive', 'complete']) {
    const document = { readyState };
    const listeners = new Map();
    const bay = {};
    const window = { bay: {}, addEventListener: (name, listener) => listeners.set(name, listener) };
    const create = () => {};
    let discoveries = 0;
    vm.runInNewContext(initialization, {
      document, window, bay, create_template_fn: create,
      get_all_bays(root) {
        assert.equal(root, document);
        assert.equal(window.bay.create, create, 'create must be available during discovery');
        assert.equal(typeof window.bay.refresh, 'function');
        discoveries++;
      },
    });

    if (readyState === 'complete') {
      assert.equal(discoveries, 1, 'late initialization must discover existing components');
      assert.equal(listeners.has('load'), false, 'do not register a redundant load scan');
    } else {
      assert.equal(discoveries, 0, 'preserve discovery timing until load');
      assert.equal(typeof listeners.get('load'), 'function');
      document.readyState = 'complete';
      listeners.get('load')();
      assert.equal(discoveries, 1);
    }
    assert.equal(bay.create, create);
    assert.equal(bay.refresh, window.bay.refresh);
  }
});
