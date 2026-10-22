// Run: node --test package/tests/native-state.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const source = transformSync(readFileSync(new URL('../bay.mts', import.meta.url), 'utf8'),
  { loader: 'ts', target: 'esnext', format: 'esm' }).code;
const start = source.indexOf('function make_map_proxy');
const end = source.indexOf('let dispatch_debounced', start);
assert.ok(start >= 0 && end > start);

function harness() {
  // Use the same native constructors on both sides of the VM boundary so the
  // production instanceof checks behave as they do within a component realm.
  const context = vm.createContext({ Map, Set, WeakMap, WeakSet, Date, trusted_html: new WeakSet() });
  vm.runInContext(source.slice(start, end), context);
  let updates = 0;
  const state = context.make_proxy_object({}, () => updates++);
  return { state, get updates() { return updates; } };
}

test('B6: Map native methods, missing values, keys and values remain compatible', () => {
  const h = harness(), key = {}, value = {};
  const raw = new Map([[key, value]]);
  h.state.map = raw;
  const map = h.state.map;
  assert.equal(map.get(key), value); assert.equal(map.get('missing'), undefined);
  assert.equal(map.has(key), true); assert.equal(map.size, 1);
  assert.deepEqual([...map.entries()], [[key, value]]);
  assert.deepEqual([...map.keys()], [key]); assert.deepEqual([...map.values()], [value]);
  assert.deepEqual([...map], [[key, value]]);
  const visited = []; map.forEach((v, k) => visited.push([k, v]));
  assert.deepEqual(visited, [[key, value]]);
  assert.equal(map.delete(key), true); assert.equal(map.delete(key), false);
  assert.equal(map.has(key), false); assert.equal(map.size, 0);
  assert.equal(map.clear(), undefined);
  assert.equal(map.constructor, Map);
});

test('B6: Map reads keep one proxy and chained set calls return that proxy', () => {
  const h = harness(); h.state.map = new Map();
  const map = h.state.map;
  assert.equal(h.state.map, map);
  const before = h.updates;
  assert.equal(map.set('a', 1).set('b', 2), map);
  assert.equal(h.updates, before + 2, 'chaining must not bypass existing set notifications');
  assert.equal(h.state.map, map);
  assert.deepEqual([...map], [['a', 1], ['b', 2]]);
});

test('B6: Set native methods, iteration, return values and chaining work with stable identity', () => {
  const h = harness(), value = {}; h.state.set = new Set();
  const set = h.state.set;
  assert.equal(h.state.set, set);
  const before = h.updates;
  assert.equal(set.add(value).add('text'), set);
  assert.equal(h.updates, before + 2);
  assert.equal(set.has(value), true); assert.equal(set.has({}), false);
  assert.equal(set.size, 2);
  assert.deepEqual([...set], [value, 'text']);
  assert.deepEqual([...set.values()], [value, 'text']);
  assert.deepEqual([...set.entries()], [[value, value], ['text', 'text']]);
  const visited = []; set.forEach(v => visited.push(v)); assert.deepEqual(visited, [value, 'text']);
  assert.equal(set.delete(value), true); assert.equal(set.delete(value), false);
  assert.equal(set.clear(), undefined); assert.equal(set.size, 0);
  assert.equal(h.state.set, set); assert.equal(set.constructor, Set);
});

test('B6: Date stays native with original identity and native getTime/setTime return values', () => {
  const h = harness(), date = new Date(0); h.state.date = date;
  assert.equal(h.state.date.getTime(), 0);
  assert.equal(h.state.date, date); assert.equal(h.state.date, h.state.date);
  const before = h.updates;
  assert.equal(h.state.date.setTime(1234), 1234);
  assert.equal(h.state.date.getTime(), 1234);
  assert.equal(h.state.date.toISOString(), '1970-01-01T00:00:01.234Z');
  assert.equal(h.updates, before, 'Date mutation is deliberately not reactive');
  h.state.date = date;
  assert.equal(h.updates, before + 1, 'reassignment remains reactive');
});

test('B6: nested native values keep stable identities while ordinary objects and arrays remain reactive', () => {
  const h = harness(), date = new Date(10);
  h.state.object = { count: 0, map: new Map(), set: new Set(), date };
  h.state.array = [{ count: 0 }, date];
  const object = h.state.object, array = h.state.array;
  assert.equal(h.state.object, object); assert.equal(h.state.array, array);
  assert.equal(object.map, object.map); assert.equal(object.set, object.set);
  assert.equal(object.date, date); assert.equal(array[1], date);
  const before = h.updates;
  object.count++; array[0].count++; array[1] = date;
  assert.equal(h.updates, before + 3);
  const beforePush = h.updates; array.push('raw & <text>');
  assert.ok(h.updates > beforePush); assert.equal(array[2], 'raw & <text>');
  assert.equal(object.count, 1); assert.equal(array[0].count, 1);
});

test('B6: existing collection mutation notification limits remain unchanged', () => {
  const h = harness(); h.state.map = new Map(); h.state.set = new Set();
  const map = h.state.map, set = h.state.set;
  map.set('key', 'raw & <text>'); set.add('raw & <text>');
  const before = h.updates;
  assert.equal(map.get('key'), 'raw & <text>'); assert.equal(set.has('raw & <text>'), true);
  map.delete('key'); set.delete('raw & <text>'); map.clear(); set.clear();
  assert.equal(h.updates, before, 'delete and clear do not gain new reactive behavior');
  h.state.map = map; h.state.set = set;
  assert.equal(h.updates, before + 2);
  assert.equal(h.state.map, map); assert.equal(h.state.set, set);
});
