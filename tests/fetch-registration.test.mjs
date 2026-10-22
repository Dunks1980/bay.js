// Run: node --test package/tests/fetch-registration.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;

// Run the actual discovery, request and dispatch code. Compilation/registration
// is a boundary stub; these tests do not simulate browser rendering.
function harness(fetch) {
  const elements = [], registrations = [], errors = [], definitions = new Map();
  const document = {
    querySelectorAll(selector) { return selector === '[bay]' ? elements : []; },
  };
  let failCompilation = false;
  const context = vm.createContext({
    document, Element: class {}, fetch,
    $: (root, selector) => root.querySelectorAll(selector),
    customElements: { get: tag => definitions.get(tag) },
    console: { error: (...args) => errors.push(args) },
    modify_template(html, element, tag) {
      if (failCompilation) { failCompilation = false; throw new Error('compile failed'); }
      registrations.push({ html, element, tag });
      definitions.set(tag, true);
    },
  });
  function load(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    vm.runInContext(source.slice(from, to), context);
  }
  load('let to_fetch', 'let blobs');
  load('const hydrated_targets', 'function apply_settings(');
  load('function remove_template_tags(', 'function fetch_includes(');
  load('function fetch_component(', 'function getAttributes(');
  // Include the public API rather than replacing refresh with a test callback.
  context.bay = {};
  context.window = { bay: {}, addEventListener() {} };
  context.create_template_fn = () => {};
  const initStart = source.indexOf('  bay.refresh =');
  vm.runInContext(source.slice(initStart, source.indexOf('\n};', initStart)), context);
  return {
    registrations, errors,
    add(tag, url = '/shared.html') {
      const element = { tagName: tag.toUpperCase(), getAttribute: () => url };
      elements.push(element);
      return element;
    },
    refresh: () => context.bay.refresh(),
    queueSize: () => vm.runInContext('to_fetch.length', context),
    failCompilation() { failCompilation = true; },
  };
}

const response = (html = '<template><p>shared</p></template>') =>
  ({ ok: true, status: 200, text: async () => html });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('B9: shared URLs fetch once and register each tag, including later discovery', async () => {
  const requests = [];
  let resolve;
  const h = harness(url => { requests.push(url); return new Promise(done => { resolve = done; }); });
  h.add('first-card'); h.add('second-card');
  h.refresh(); h.refresh();
  assert.deepEqual(requests, ['/shared.html']);
  resolve(response());
  await settle();
  assert.deepEqual(h.registrations.map(entry => entry.tag), ['first-card', 'second-card']);
  assert.ok(h.registrations.every(entry => entry.html === '<!--<template>--><p>shared</p><!--</template>-->'));
  h.add('third-card'); h.refresh();
  await settle();
  assert.equal(requests.length, 1);
  assert.deepEqual(h.registrations.map(entry => entry.tag), ['first-card', 'second-card', 'third-card']);
});

for (const failure of ['network', 'HTTP', 'body']) {
  test(`B9: ${failure} failure is not completed and discovery retries`, async () => {
    let attempts = 0;
    const h = harness(async () => {
      if (++attempts > 1) return response();
      if (failure === 'network') throw new Error('offline');
      if (failure === 'HTTP') return { ok: false, status: 503, text: async () => 'unavailable' };
      return { ok: true, text: async () => { throw new Error('body interrupted'); } };
    });
    h.add('first-card'); h.add('second-card');
    h.refresh(); h.refresh();
    await settle();
    assert.equal(attempts, 1);
    assert.equal(h.registrations.length, 0);
    assert.ok(h.errors.length > 0);
    h.refresh();
    await settle();
    assert.equal(attempts, 2);
    assert.deepEqual(h.registrations.map(entry => entry.tag), ['first-card', 'second-card']);
    h.refresh(); await settle();
    assert.equal(attempts, 2);
    assert.equal(h.registrations.length, 2);
  });
}

test('B9: duplicate discovery and same-tag instances do not duplicate queue or registration', async () => {
  let attempts = 0, resolve;
  const h = harness(() => { attempts++; return new Promise(done => { resolve = done; }); });
  h.add('same-card'); h.add('same-card');
  for (let i = 0; i < 10; i++) h.refresh();
  assert.equal(h.queueSize(), 0);
  assert.equal(attempts, 1);
  resolve(response()); await settle();
  for (let i = 0; i < 10; i++) h.refresh();
  await settle();
  assert.equal(h.registrations.length, 1);
  assert.equal(attempts, 1);
  assert.equal(h.queueSize(), 0);
});

test('B9: failed registration can retry using the successful template cache', async () => {
  let attempts = 0;
  const h = harness(async () => { attempts++; return response(); });
  h.add('retry-card'); h.failCompilation(); h.refresh();
  await settle();
  assert.equal(h.registrations.length, 0);
  h.refresh(); await settle();
  assert.equal(h.registrations.length, 1);
  assert.equal(attempts, 1);
});
