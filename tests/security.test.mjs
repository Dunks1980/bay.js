// Run with: node --test package/tests/security.test.mjs (from the workspace root).
// Uses Node's test runner and the workspace's existing development tools only.
// Tests the authoritative TypeScript source without regenerating distribution files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';
import { parseFragment, serialize } from '../../bayjs.org/node_modules/parse5/dist/index.js';

const source = readFileSync(new URL('../bay.mts', import.meta.url), 'utf8');
const javascript = transformSync(source, {
  loader: 'ts', target: 'esnext', format: 'esm',
}).code;

function section(start, end) {
  const first = javascript.indexOf(start);
  const last = javascript.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Source section missing: ${start}`);
  return javascript.slice(first, last);
}

function textOf(node) {
  return node.nodeName === '#text'
    ? node.value
    : (node.childNodes ?? []).map(textOf).join('');
}

// Minimal adapter for the textarea operations in escapeHTML/decodeHtml.
// parse5 supplies HTML serialization/entity parsing; this is not a browser DOM.
function textarea() {
  let text = '';
  return {
    set textContent(value) { text = String(value); },
    get innerHTML() {
      return serialize({ childNodes: [{ nodeName: '#text', value: text }] });
    },
    set innerHTML(value) {
      const context = { nodeName: 'textarea', tagName: 'textarea',
        namespaceURI: 'http://www.w3.org/1999/xhtml', attrs: [] };
      text = textOf(parseFragment(context, String(value)));
    },
    get value() { return text; },
  };
}

function harness() {
  const context = vm.createContext({
    document: { createElement: textarea },
    window: { bay: {} },
    data_attr: 'data-bay-', local_name: '$bay',
  });
  vm.runInContext(
    section('const modifiers_array =', '(function attachShadowRoots')
      + section('const escape =', 'function emit(')
      + section('function booleanAttributeProperty(', 'function copyAttributes(')
      + section('function make_map_proxy', 'let dispatch_debounced')
      + section('function apply_events(', 'function render_debouncer(')
      + '\nthis.api = { escapeHTML, decodeHtml, html: trustHTML, render_template, make_proxy_object, make_map_proxy, make_set_proxy, apply_events };',
    context,
  );
  let updates = 0;
  const state = context.api.make_proxy_object({}, () => updates++);
  const bay = { proxy: state };
  context.window.bay.instance = bay;

  return {
    ...context.api, state,
    get updates() { return updates; },
    // Invoke an actual generated template literal in the test VM. No runtime
    // library code is rewritten, and no network or Blob loader is required.
    render(template) {
      context.$bay = { decode: context.api.decodeHtml, encode: context.api.escapeHTML,
        html: context.api.html, render: context.api.render_template };
      context.state = state;
      return vm.runInContext(
        '(function(){ "use strict"; return $bay.render`' + template + '`; }).call(state)',
        context,
      );
    },
    click(markup, { key, ctrlKey = false } = {}) {
      const button = parseFragment(markup).childNodes[0];
      const attribute = button.attrs.find(attr => attr.name.startsWith('data-bay-'));
      assert.ok(attribute, 'Event attribute must survive HTML parsing');
      const element = new EventTarget();
      element.closest = () => true;
      const ref = { uniqid: 'instance', newEvents: '', eventHandlers: new Map() };
      context.api.apply_events(ref, attribute, element, 0, 'data-owner');
      context.$bay = bay;
      context.state = state;
      // addBlob_event executes this generated handler body with proxy state as
      // `this`. Exercise that body directly, avoiding browser-only Blob imports.
      vm.runInContext(
        '(function(){ "use strict";\n' + ref.newEvents + '\n}).call(state)', context,
      );
      const event = new Event(attribute.name.includes('keydown') ? 'keydown' : 'click',
        { cancelable: true });
      Object.defineProperties(event, { key: { value: key }, ctrlKey: { value: ctrlKey } });
      // Call the generated handler directly so exceptions are test failures,
      // rather than uncaught EventTarget errors scheduled by Node.
      bay.events.get(attribute.name + '-0')(event);
      return event;
    },
  };
}

function assertLiteralText(markup, expected) {
  const nodes = parseFragment(markup).childNodes;
  assert.ok(nodes.every(node => node.nodeName === '#text'),
    'Untrusted interpolation must not create HTML elements');
  assert.equal(nodes.map(textOf).join(''), expected);
}

const payload = '<img src=x onerror="globalThis.compromised=true">';
const handlerPayload = "');this.compromised=true;this.pick('";

test('ordinary direct/nested strings and reactive mutations still work', () => {
  const h = harness();
  h.state.name = 'Alice';
  h.state.user = { name: 'Bob' };
  assert.equal(h.render('${this.name} / ${this.user.name}'), 'Alice / Bob');
  const before = h.updates;
  h.state.user.name = 'Carol';
  assert.equal(h.updates, before + 1);
  assert.equal(h.render('${this.user.name}'), 'Carol');
});

test('direct assignments escape markup, entities, and quotation marks on output', () => {
  for (const value of [payload, 'A&B < C > D', '&lt;b&gt;', `He said "it's fine"`]) {
    const h = harness();
    h.state.name = value;
    assertLiteralText(h.render('${this.name}'), value);
  }
});

test('B1: initialized nested object strings must render as literal text', () => {
  const h = harness();
  h.state.user = { name: payload };
  assertLiteralText(h.render('${this.user.name}'), payload);
});

test('B1: initialized nested array strings must render as literal text', () => {
  const h = harness();
  h.state.users = [{ name: payload }];
  assertLiteralText(h.render('${this.users[0].name}'), payload);
});

test('B1: existing HTML entities in nested strings must stay literal', () => {
  const h = harness();
  h.state.user = { name: '&lt;img&gt; &amp; "quoted"' };
  assertLiteralText(h.render('${this.user.name}'), '&lt;img&gt; &amp; "quoted"');
});

test('mutations through an existing nested proxy escape output', () => {
  const h = harness();
  h.state.user = { name: 'Alice' };
  h.state.user.name = payload;
  assertLiteralText(h.render('${this.user.name}'), payload);
});

test('state should retain raw values and repeated assignments must not double-escape', () => {
  const h = harness();
  h.state.name = 'A&B <b>';
  assert.equal(h.state.name, 'A&B <b>', 'State should not contain output encoding');
  h.state.name = h.state.name;
  assertLiteralText(h.render('${this.name}'), 'A&B <b>');
});

test('repeated assignments must preserve the visible value', () => {
  const h = harness();
  h.state.name = 'A&B <b>';
  h.state.name = h.state.name;
  assertLiteralText(h.render('${this.name}'), 'A&B <b>');
});

test('B7: raw strings survive repeated direct, nested and array state updates with one output encoding', () => {
  const h = harness();
  const raw = 'A&B <b> "quoted" &lt;already encoded&gt;';
  h.state.value = raw;
  h.state.nested = { value: raw };
  h.state.items = [raw];
  for (let i = 0; i < 3; i++) {
    assert.equal(h.state.value, raw);
    assert.equal(h.state.nested.value, raw);
    assert.equal(h.state.items[0], raw);
    for (const expression of ['${this.value}', '${this.nested.value}', '${this.items[0]}']) {
      assertLiteralText(h.render(expression), raw);
    }
    assert.equal(h.render('${this.value}'), 'A&amp;B &lt;b&gt; &quot;quoted&quot; &amp;lt;already encoded&amp;gt;');
    h.state.value = h.state.value;
    h.state.nested.value = h.state.nested.value;
    h.state.items[0] = h.state.items[0];
  }
});

test('B7: null remains null on direct, nested and array reads and JSON serialization', () => {
  const h = harness();
  h.state.value = null;
  h.state.nested = { value: null };
  h.state.items = [null];
  assert.equal(h.state.value, null);
  assert.equal(h.state.nested.value, null);
  assert.equal(h.state.items[0], null);
  assert.equal(JSON.stringify(h.state), '{"value":null,"nested":{"value":null},"items":[null]}');
  assert.equal(h.render('${this.value === null} / ${this.nested.value === null}'), 'true / true');
  const before = h.updates;
  h.state.value = h.state.value;
  h.state.nested.value = h.state.nested.value;
  h.state.items[0] = h.state.items[0];
  assert.equal(h.updates, before + 3);
  assert.equal(h.state.value, null);
  assert.equal(h.state.nested.value, null);
  assert.equal(h.state.items[0], null);
});

test('B7: null, undefined, empty strings, zero and false retain their state and text semantics', () => {
  const h = harness();
  for (const [value, read, text] of [[null, null, ''], [undefined, '', ''], ['', '', ''], [0, 0, '0'], [false, false, 'false']]) {
    h.state.value = value;
    assert.equal(Object.getOwnPropertyDescriptor(h.state, 'value').value, value, 'assignment preserves the raw value');
    assert.equal(h.state.value, read);
    assert.equal(h.render('${this.value}'), text);
    assert.equal(h.render('${this.value == null ? "nullish" : "present"}'), value === null ? 'nullish' : 'present');
  }
  assert.equal(h.state.missing, '', 'preserve the existing missing/undefined read fallback');
  assert.equal(h.render('${this.missing}'), '');
});

test('B7: nullish text stays empty while explicit trusted HTML retains its identity and trust', () => {
  const h = harness();
  const trusted = h.html('<strong>trusted</strong>');
  h.state.value = null;
  assert.equal(h.render('${this.value}'), '');
  h.state.value = trusted;
  h.state.nested = { value: trusted };
  assert.equal(h.state.value, trusted);
  assert.equal(h.state.nested.value, trusted);
  assert.equal(h.render('${this.value} / ${this.nested.value}'), '<strong>trusted</strong> / <strong>trusted</strong>');
  h.state.value = '<strong>untrusted</strong>';
  assertLiteralText(h.render('${this.value}'), '<strong>untrusted</strong>');
  h.state.value = undefined;
  assert.equal(h.render('${this.value}'), '');
});

test('intentional HTML uses explicit html; decoding entities does not grant trust', () => {
  const h = harness();
  h.state.html = '<strong>trusted</strong>';
  assertLiteralText(h.render('${$bay.decode(this.html)}'), '<strong>trusted</strong>');
  const rendered = h.render('${$bay.html(this.html)}');
  assert.equal(parseFragment(rendered).childNodes[0].tagName, 'strong');
  assert.equal(textOf(parseFragment(rendered)), 'trusted');
});

test('legacy interpolated handler syntax is rejected even for ordinary strings', () => {
  const h = harness();
  h.state.name = 'Alice';
  h.state.pick = value => { h.state.picked = value; };
  assert.throws(() => h.render('<button data-bay-click="this.pick(\'${this.name}\')">Pick</button>'),
    /read state directly in event handlers/);
  h.click(h.render('<button data-bay-click="this.pick(this.name)">Pick</button>'));
  assert.equal(h.state.picked, 'Alice');
});

test('B2: interpolated handler data must not execute as source', () => {
  const h = harness();
  h.state.name = handlerPayload;
  h.state.pick = () => {};
  assert.throws(() => h.click(h.render('<button data-bay-click="this.pick(\'${this.name}\')">Pick</button>')),
    /read state directly in event handlers/);
  assert.equal(h.state.compromised, '', 'Injected assignment executed');
});

test('B2: an apostrophe in interpolated handler data must remain data', () => {
  const h = harness();
  h.state.name = "O'Brien";
  h.state.pick = value => { h.state.picked = value; };
  assert.throws(() => h.render('<button data-bay-click="this.pick(\'${this.name}\')">Pick</button>'),
    /read state directly in event handlers/);
  h.click(h.render('<button data-bay-click="this.pick(this.name)">Pick</button>'));
  assert.equal(h.state.picked, "O'Brien");
});

test('reading state directly in handlers does not compile it as source', () => {
  const h = harness();
  let received;
  h.state.name = handlerPayload;
  h.state.pick = value => { received = value; };
  h.click('<button data-bay-click="this.pick(this.name)">Pick</button>');
  assert.equal(h.state.compromised, '');
  assert.equal(received, h.state.name);
});

test('existing static event expressions and modifiers continue to run', () => {
  const h = harness();
  h.state.count = 0;
  const markup = '<button data-bay-keydown.enter.ctrl.prevent="this.count++">Run</button>';
  h.click(markup, { key: 'Escape', ctrlKey: true });
  assert.equal(h.state.count, 0);
  const event = h.click(markup, { key: 'Enter', ctrlKey: true });
  assert.equal(h.state.count, 1);
  assert.equal(event.defaultPrevented, true);
});

test('attribute interpolation cannot add markup, attributes, or handlers', () => {
  const h = harness();
  h.state.value = `\" onmouseover=\"alert(1)\" ' = \` <img src=x>`;
  for (const template of ['<input title="${this.value}">', "<input title='${this.value}'>",
    '<input title=${this.value}>']) {
    const element = parseFragment(h.render(template)).childNodes[0];
    assert.equal(element.attrs.length, 1);
    assert.equal(element.attrs[0].name, 'title');
    assert.equal(element.attrs[0].value, h.state.value);
  }
});

test('URLs validate the completed attribute, including split schemes and entities', () => {
  const h = harness();
  for (const value of ['javascript:alert(1)', 'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)']) {
    h.state.url = value;
    assert.throws(() => h.render('<a href="${this.url}">go</a>'), /unsafe URL scheme/);
  }
  h.state.part = 'script';
  assert.throws(() => h.render('<a href="java${this.part}:alert(1)">go</a>'), /unsafe URL scheme/);
  h.state.part = 'java';
  assert.throws(() => h.render('<a href="${this.part}script&#58;alert(1)">go</a>'), /unsafe URL scheme/);
  for (const url of ['/path?a=1&b=2', '#section', 'https://example.com', 'mailto:a@example.com']) {
    h.state.url = url;
    assert.equal(parseFragment(h.render('<a href="${this.url}">go</a>')).childNodes[0].attrs[0].value, url);
  }
});

test('native event attributes, srcdoc, srcset, and dynamic HTML syntax fail closed', () => {
  const h = harness();
  h.state.value = 'alert(1)';
  for (const template of ['<button onclick="${this.value}">x</button>',
    '<button :click="${this.value}">x</button>', '<iframe srcdoc="${this.value}"></iframe>',
    '<img srcset="${this.value}">', '<${this.value}>', '<p ${this.value}>x</p>',
    '<script>${this.value}</script>', '<style>${this.value}</style>', '<!--${this.value}-->',
    '<script src="${this.value}"></script>', '<object data="${this.value}"></object>',
    '<script></scriptx>${this.value}</script>', '<script/>${this.value}</script>']) {
    assert.throws(() => h.render(template), /Bay template security/);
  }
});

test('trusted HTML is explicit and does not bypass attribute encoding or handler checks', () => {
  const h = harness();
  h.state.trusted = h.html('<strong title="x">trusted</strong>');
  assert.equal(parseFragment(h.render('${this.trusted}')).childNodes[0].tagName, 'strong');
  assert.equal(parseFragment(h.render('<div title="${this.trusted}"></div>')).childNodes[0].attrs.length, 1);
  assert.throws(() => h.render('<button data-bay-click="${this.trusted}">x</button>'), /read state directly/);
  h.state.fragment = h.html('aria-label="trusted"');
  assert.equal(parseFragment(h.render('<button ${this.fragment}>x</button>')).childNodes[0].attrs[0].value, 'trusted');
  h.state.forged = { ...h.state.trusted, isProxy: true };
  assertLiteralText(h.render('${this.forged}'), '<strong title="x">trusted</strong>');
});

test('textarea text and nested JavaScript template expressions stay safe', () => {
  const h = harness();
  h.state.value = '</textarea><img src=x onerror=alert(1)>';
  const node = parseFragment(h.render('<textarea>${this.value}</textarea>')).childNodes[0];
  assert.equal(node.tagName, 'textarea');
  assert.equal(textOf(node), h.state.value);
  assertLiteralText(h.render('${`value: ${this.value.replace(/}/g, "}")}`}'), 'value: ' + h.state.value);
});

test('collection mutation wrappers store raw strings rather than HTML entities', () => {
  const h = harness();
  let updates = 0;
  const map = h.make_map_proxy(new Map(), () => updates++);
  const set = h.make_set_proxy(new Set(), () => updates++);
  map.set('value', payload);
  set.add(payload);
  assert.equal(map.get('value'), payload);
  assert.equal(set.has(payload), true);
  assert.equal(updates, 2);
});
