// Run: node --test package/tests/includes.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';
import { parse, parseFragment, serialize } from '../../bayjs.org/node_modules/parse5/dist/index.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;

// parse5-backed adapter for the compiler's DOM operations. Rendering is outside
// these tests; create_component captures the finished markup, styles and inputs.
const wrappers = new WeakMap();
function wrap(node) {
  if (!node) return null;
  if (wrappers.has(node)) return wrappers.get(node);
  const wrapper = {
    get attributes() { return node.attrs ?? []; },
    get parentElement() { return node.parentNode?.tagName ? wrap(node.parentNode) : null; },
    closest(tag) { return node.tagName === tag ? wrapper : wrapper.parentElement?.closest(tag); },
    querySelectorAll(selector) {
      const results = [];
      function visit(parent) {
        for (const child of parent.childNodes ?? []) {
          if (child.tagName === selector || (selector[0] === '#' &&
            child.attrs?.some(attr => attr.name === 'id' && attr.value === selector.slice(1)))) results.push(wrap(child));
          visit(child);
        }
      }
      visit(node);
      return results;
    },
    getElementById(id) { return wrapper.querySelectorAll('#' + id)[0]; },
    remove() {
      const siblings = node.parentNode?.childNodes;
      if (siblings) siblings.splice(siblings.indexOf(node), 1);
      node.parentNode = null;
    },
    set outerHTML(text) {
      const parent = node.parentNode;
      const fragment = parseFragment(parent.tagName ? parent : undefined, text);
      for (const child of fragment.childNodes) child.parentNode = parent;
      parent.childNodes.splice(parent.childNodes.indexOf(node), 1, ...fragment.childNodes);
      node.parentNode = null;
    },
    get markup() { return serialize(node); },
  };
  wrappers.set(node, wrapper);
  return wrapper;
}

function harness(fetch) {
  const compiled = [], errors = [], definitions = new Map();
  const context = vm.createContext({
    fetch, URL, settings: undefined,
    document: { baseURI: 'https://example.test/page/base/' },
    DOMParser: class { parseFromString(text) { return wrap(parse(text)); } },
    customElements: { get: tag => definitions.get(tag) },
    console: { error: (...args) => errors.push(args) },
    getAttributes: bay => bay.attrs,
    create_component(html, tag, attrs, styles, revoke) {
      compiled.push({ markup: html.markup, tag, attrs, styles, revoke });
      definitions.set(tag, true);
    },
  });
  function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
  }
  vm.runInContext(section('const include_fetches', 'let blobs') +
    section('function apply_settings(', 'function fetch_component('), context);
  return {
    compiled, errors,
    modify(tag, text, attrs = []) { context.modify_template(text, { attrs }, tag); },
    create(tag, text, attrs = []) { context.create_template_fn(tag, text, attrs); },
  };
}

const response = text => ({ ok: true, text: async () => text });
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('B8: concurrent compiler entry points isolate styles, attributes and markup', async () => {
  const a = deferred(), b = deferred();
  const h = harness(src => ({ a, b })[src].promise);
  h.modify('a-card', '<style>.a{color:red}</style><include src="a"></include>', ['a-attr']);
  h.create('B-CARD', '<style>.b{color:blue}</style><include src="b"></include>', ['b-attr']);
  b.resolve(response('<style>.b-extra{display:block}</style><p>B</p>'));
  await settle();
  a.resolve(response('<style>.a-extra{display:flex}</style><p>A</p>'));
  await settle();
  assert.equal(h.compiled.length, 2);
  const [bc, ac] = h.compiled;
  assert.equal(ac.styles, '.a{color:red}.a-extra{display:flex}');
  assert.equal(bc.styles, '.b{color:blue}.b-extra{display:block}');
  assert.deepEqual(ac.attrs, ['a-attr']); assert.deepEqual(bc.attrs, ['b-attr']);
  assert.match(ac.markup, /<p>A<\/p>/); assert.doesNotMatch(ac.markup, /<p>B<\/p>/);
  assert.match(bc.markup, /<p>B<\/p>/); assert.equal(bc.tag, 'b-card');
  assert.equal(ac.revoke, false); assert.equal(bc.revoke, true);
});

test('B8: nested includes finish once, deduplicate URLs and keep page-relative resolution', async () => {
  const requests = [];
  const h = harness(async src => {
    requests.push(src);
    return response(src === 'parts/outer.html'
      ? '<style>.outer{}</style><section><include src="./leaf.html"></include></section>'
      : '<style>.leaf{}</style><p>leaf</p>');
  });
  h.modify('nested-card', '<include src="parts/outer.html"></include><include src="./leaf.html"></include>');
  await settle();
  assert.deepEqual(requests, ['parts/outer.html', './leaf.html']);
  assert.equal(h.compiled.length, 1);
  assert.equal(h.compiled[0].styles, '.outer{}.leaf{}.leaf{}');
  assert.equal((h.compiled[0].markup.match(/<p>leaf<\/p>/g) ?? []).length, 2);
  assert.doesNotMatch(h.compiled[0].markup, /<include/);
  assert.equal(h.errors.length, 0);
});

test('B8: sibling style order follows markup even when requests complete in reverse order', async () => {
  const a = deferred(), b = deferred();
  const h = harness(src => ({ a, b })[src].promise);
  h.create('order-card', '<include src="a"></include><include src="b"></include>');
  b.resolve(response('<style>.b{}</style>B')); await settle();
  assert.equal(h.compiled.length, 0);
  a.resolve(response('<style>.a{}</style>A')); await settle();
  assert.equal(h.compiled.length, 1);
  assert.equal(h.compiled[0].styles, '.a{}.b{}');
});

test('B8: concurrent components share in-flight includes without sharing compilation state', async () => {
  const pending = deferred();
  let attempts = 0;
  const h = harness(() => { attempts++; return pending.promise; });
  h.modify('first-card', '<style>.first{}</style><include src="shared"></include>');
  h.create('second-card', '<style>.second{}</style><include src="./shared"></include>');
  assert.equal(attempts, 1);
  pending.resolve(response('<style>.shared{}</style><p>shared</p>'));
  await settle();
  assert.equal(h.compiled.length, 2);
  assert.equal(h.compiled[0].styles, '.first{}.shared{}');
  assert.equal(h.compiled[1].styles, '.second{}.shared{}');
  h.create('later-card', '<include src="shared"></include>'); await settle();
  assert.equal(attempts, 2, 'later compilations may fetch fresh include content');
  assert.equal(h.compiled.length, 3);
});

for (const failure of ['network', 'HTTP', 'body']) {
  test(`B8: ${failure} failure removes only the failed include and allows later retry`, async () => {
    let attempts = 0;
    const h = harness(async src => {
      if (src === 'outer') return response('<style>.outer{}</style><include src="bad"></include><include src="good"></include>');
      if (src === 'good') return response('<p>good</p>');
      if (++attempts > 1) return response('<p>recovered</p>');
      if (failure === 'network') throw new Error('offline');
      if (failure === 'HTTP') return { ok: false, status: 500, statusText: 'failed' };
      return { ok: true, text: async () => { throw new Error('interrupted'); } };
    });
    h.modify('failure-card', '<style>.base{}</style><include src="outer"></include>');
    await settle();
    assert.equal(h.compiled.length, 1);
    assert.match(h.compiled[0].markup, /<p>good<\/p>/);
    assert.doesNotMatch(h.compiled[0].markup, /<include/);
    assert.equal(h.compiled[0].styles, '.base{}.outer{}');
    assert.equal(h.errors.length, 1);
    h.create('recovered-card', '<include src="bad"></include>'); await settle();
    assert.equal(attempts, 2);
    assert.equal(h.compiled.length, 2);
    assert.match(h.compiled[1].markup, /<p>recovered<\/p>/);
  });
}

test('B8: direct and indirect cycles terminate without treating repeated siblings as cycles', async () => {
  for (const indirect of [false, true]) {
    const requests = [];
    const h = harness(async src => {
      requests.push(src);
      return response(src === 'a' && indirect
        ? '<p>A</p><include src="b"></include>'
        : '<p>cycle branch</p><include src="./a#same-resource"></include>');
    });
    h.create('cycle-card', '<include src="a"></include><include src="a"></include>');
    await settle();
    assert.deepEqual(requests, indirect ? ['a', 'b'] : ['a']);
    assert.equal(h.compiled.length, 1);
    assert.doesNotMatch(h.compiled[0].markup, /<include/);
    assert.equal(h.errors.length, 2);
    assert.ok(h.errors.every(args => String(args[1]).includes('Circular Bay include')));
  }
});

test('B8: missing sources are removed and templates without includes still compile synchronously', async () => {
  const h = harness(() => { throw new Error('unexpected request'); });
  h.create('plain-card', '<style>.plain{}</style><p>plain</p>');
  assert.equal(h.compiled.length, 1);
  assert.equal(h.compiled[0].styles, '.plain{}');
  h.modify('missing-card', '<include></include><p>remaining</p>'); await settle();
  assert.equal(h.compiled.length, 2);
  assert.match(h.compiled[1].markup, /remaining/);
  assert.doesNotMatch(h.compiled[1].markup, /<include/);
  assert.equal(h.errors.length, 1);
});
