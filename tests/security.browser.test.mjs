// Optional real-browser integration: node --test package/tests/security.browser.test.mjs
// Uses installed Chrome (or BAY_TEST_BROWSER), Node, and existing esbuild only.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { browserRuntime } from './browser-runtime.mjs';

async function browserChecks() {
  // dump-dom's virtual clock does not reliably advance compositor frames after
  // startup. Keep Bay's scheduling/cancellation path, with deterministic timers.
  window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16);
  window.cancelAnimationFrame = id => clearTimeout(id);
  const { default: bay } = await import('/bay.mjs');
  bay();
  const checks = [];
  const errors = [];
  window.auditErrors = errors;
  const originalError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
  window.addEventListener('unhandledrejection', event => {
    errors.push(String(event.reason));
    event.preventDefault();
  });
  const check = (name, condition) => { checks.push({ name, pass: Boolean(condition) }); };
  const wait = async predicate => {
    for (let i = 0; i < 150; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Timed out waiting for component rendering');
  };
  window.fixture = {
    user: { name: '<img src=x onerror="window.compromised=true">' },
    items: [{ name: '<b>item</b>' }, { name: '&lt;literal&gt;' }],
    name: "O'Brien');window.compromised=true;//",
  };
  bay.create('security-child', '<p>${$prop(this.data).name}</p>', ['data']);
  bay.create('security-main', `
    <p id="nested">\${this.user.name}</p>
    <p id="trusted">\${$bay.html('<strong>trusted</strong>')}</p>
    <p id="decoded">\${$bay.decode('&lt;em&gt;decoded&lt;/em&gt;')}</p>
    <map array="this.items" params="item"><span class="mapped">\${item.name}</span></map>
    <for array="this.items" params="item"><span class="foreach">\${item.name}</span></for>
    <for this="let i=0;i<2;i++"><span class="counted">\${this.items[i].name}</span></for>
    <span bay-map="this.items" params="item" class="attr-map">\${item.name}</span>
    <span bay-for="this.items" params="item" class="attr-for">\${item.name}</span>
    <if this="this.visible"><p id="conditional">\${this.user.name}</p></if>
    <else><p id="hidden">hidden</p></else>
    <switch this="this.visible"><case this="true" break><p id="case">\${this.user.name}</p></case><default>other</default></switch>
    <router this="/"><p id="route">\${this.user.name}</p></router>
    <button id="pick" :click.prevent="this.pick(this.name)">Pick</button>
    <input id="bound" bind="this.name">
    <select id="select" bind="this.options"></select>
    <security-child data="\${this.user}"></security-child>
    <div id="attrs" this-attribute="this.attrs"></div>
    <script render>return '<i>plain</i>';</script>
    <inner-html><p id="light">\${this.user.name}</p></inner-html>
    <script>
      this.user = window.fixture.user; this.items = window.fixture.items;
      this.name = window.fixture.name; this.visible = true;
      this.options = [{value:'1', text:'<img src=x>', selected:true}];
      this.attrs = $bay.html('aria-label="trusted attributes"');
      this.pick = value => { window.picked = value; };
    </script>`);
  const main = document.createElement('security-main');
  document.body.append(main);
  await wait(() => main.shadowRoot?.querySelector('#pick') && window.bay[main.uniqid].events);
  const root = main.shadowRoot;
  check('nested output stays text', root.querySelector('#nested').textContent === window.fixture.user.name);
  check('untrusted markup creates no elements', !root.querySelector('img,b,i,em'));
  check('explicit trusted HTML renders', root.querySelector('#trusted strong')?.textContent === 'trusted');
  check('decode does not grant trust', root.querySelector('#decoded').textContent === '<em>decoded</em>');
  for (const selector of ['.mapped', '.foreach', '.counted', '.attr-map', '.attr-for']) {
    const elements = [...root.querySelectorAll(selector)];
    check(selector + ' preserves structure and encodes values', elements.length === 2 &&
      elements.every((element, i) => element.textContent === window.fixture.items[i].name));
  }
  check('conditional preserves structure', root.querySelector('#conditional')?.textContent === window.fixture.user.name);
  check('switch preserves structure', root.querySelector('#case')?.textContent === window.fixture.user.name);
  check('router preserves structure and encodes data', root.querySelector('#route')?.textContent === window.fixture.user.name);
  root.querySelector('#pick').click();
  check('handler gets raw quoted data', window.picked === window.fixture.name && !window.compromised);
  check('input binding preserves raw quotes', root.querySelector('#bound').value === window.fixture.name);
  check('select data stays text', root.querySelector('#select option')?.textContent === '<img src=x>');
  let rejectedOption = false;
  try { window.bay[main.uniqid].option({ text:'test', onclick:'window.compromised=true' }); }
  catch (error) { rejectedOption = String(error).includes('unsafe option attribute'); }
  check('select option event source is rejected', rejectedOption && !window.compromised);
  check('explicit trusted attribute fragment works', root.querySelector('#attrs').getAttribute('aria-label') === 'trusted attributes');
  check('light DOM is encoded', main.querySelector('#light')?.textContent === window.fixture.user.name && !main.querySelector('img'));
  const child = root.querySelector('security-child');
  await wait(() => child.shadowRoot?.querySelector('p'));
  check('serialized nested props stay raw and render safely', child.shadowRoot.querySelector('p').textContent === window.fixture.user.name && !child.shadowRoot.querySelector('img'));
  main.shadowRoot.proxy.user.name = 'A&B <updated>';
  await wait(() => root.querySelector('#nested').textContent === 'A&B <updated>');
  main.shadowRoot.proxy.user.name = main.shadowRoot.proxy.user.name;
  await new Promise(resolve => setTimeout(resolve, 60));
  check('repeated reactive updates do not double encode', root.querySelector('#nested').textContent === 'A&B <updated>');
  main.shadowRoot.proxy.visible = false;
  await wait(() => root.querySelector('#hidden'));
  check('conditional updates still work', !root.querySelector('#conditional'));
  const errorsBefore = errors.length;
  bay.create('security-legacy', '<button :click="this.pick(\'${this.name}\')">Pick</button><script>this.name=window.fixture.name;</script>');
  document.body.append(document.createElement('security-legacy'));
  await wait(() => errors.length > errorsBefore);
  check('legacy handler interpolation fails closed', errors.at(-1).includes('read state directly in event handlers') && !window.compromised);
  check('no unexpected asynchronous errors', errors.length === 1);
  document.querySelector('#result').textContent = JSON.stringify({ checks, errors });
}

test('full component compiler and Blob modules under CSP in installed Chrome', async t => {
  const browser = process.env.BAY_TEST_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!existsSync(browser)) return t.skip('Set BAY_TEST_BROWSER to an installed Chromium browser');
  const runtime = browserRuntime(new URL('../bay.mts', import.meta.url));
  const server = createServer((request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' blob:; style-src 'self' blob:; img-src 'none'");
    response.setHeader('Content-Type', /\.m?js$/.test(request.url ?? '') ? 'text/javascript' : 'text/html');
    if (request.url === '/bay.mjs') return response.end(runtime.module);
    if (request.url === '/distribution.js') return response.end(runtime.classic);
    if (request.url === '/checks.mjs') return response.end(`(${browserChecks.toString()})().catch(error => { document.querySelector('#result').textContent = JSON.stringify({fatal:String(error), stack:error.stack, errors:window.auditErrors, templates:[...document.querySelectorAll('security-main')].map(el=>({tmp:el.tmp, html:el.shadowRoot?.innerHTML}))}); });`);
    response.end('<!doctype html><html><body><pre id="result">pending</pre>' + runtime.script + '<script type="module" src="/checks.mjs"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = mkdtempSync(join(tmpdir(), 'bay-security-browser-'));
  try {
    const { stdout } = await promisify(execFile)(browser, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--run-all-compositor-stages-before-draw',
      '--disable-extensions', '--disable-background-networking',
      `--user-data-dir=${profile}`, '--dump-dom', '--virtual-time-budget=10000',
      `http://127.0.0.1:${server.address().port}/`,
    ], { timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    const result = /<pre id="result">([\s\S]*?)<\/pre>/.exec(stdout)?.[1]
      .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
    assert.ok(result && result !== 'pending', 'Browser did not finish: ' + stdout.slice(-1500));
    const report = JSON.parse(result);
    assert.equal(report.fatal, undefined, JSON.stringify(report));
    for (const check of report.checks) assert.equal(check.pass, true, check.name);
    t.diagnostic(`${report.checks.length} browser assertions passed under script-src 'self' blob:`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    // Only remove the temporary profile created by this test, never workspace data.
    const target = resolve(profile);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('bay-security-browser-'));
    rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
