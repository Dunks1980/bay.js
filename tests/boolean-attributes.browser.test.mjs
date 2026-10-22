// Run: node --test package/tests/boolean-attributes.browser.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { browserRuntime } from './browser-runtime.mjs';

async function checks() {
  window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16);
  window.cancelAnimationFrame = id => clearTimeout(id);
  const results = [], errors = [];
  window.addEventListener('error', e => errors.push(String(e.error ?? e.message)));
  window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
  const check = (name, pass) => results.push({ name, pass: Boolean(pass) });
  const wait = async predicate => {
    for (let i = 0; i < 100; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw Error('Timed out waiting for boolean attribute update');
  };
  const { default: bay } = await import('/bay.mjs'); bay();
  bay.create('boolean-fixture', `
    <input id="field" type="checkbox" disabled="\${this.flag}" checked="\${this.flag}" required="\${this.flag}" readonly="\${this.flag}" aria-disabled="\${this.flag}" data-enabled="\${this.flag}" title="\${this.flag}">
    <div id="hidden" hidden="\${this.flag}">hidden</div>
    <div id="enumerated" draggable="\${this.flag}" spellcheck="\${this.flag}" contenteditable="\${this.flag}">enum</div>
    <input id="static" disabled="false" checked required>
    <div id="until" hidden="\${this.hiddenMode}">until found</div>
    <p id="tick">\${this.tick}</p>
    <script>this.flag=false; this.tick=0; this.hiddenMode='until-found';</script>`);
  const host = document.createElement('boolean-fixture'); document.body.append(host);
  await wait(() => host.shadowRoot?.querySelector('#field'));
  const root = host.shadowRoot, state = root.proxy;
  for (const flag of [false, true, false, true, false]) {
    state.flag = flag; state.tick++;
    const tick = String(state.tick);
    await wait(() => root.querySelector('#tick').textContent === tick);
    const field = root.querySelector('#field'), hidden = root.querySelector('#hidden');
    for (const attr of ['disabled', 'checked', 'required']) {
      check(`${attr} presence and property follow ${flag} at ${tick}`, field.hasAttribute(attr) === flag && field[attr] === flag);
    }
    check(`readonly uses native readOnly property at ${tick}`, field.hasAttribute('readonly') === flag && field.readOnly === flag);
    check(`hidden presence and property follow ${flag} at ${tick}`, hidden.hasAttribute('hidden') === flag && hidden.hidden === flag);
    for (const attr of ['aria-disabled', 'data-enabled', 'title']) {
      check(`${attr} retains string ${flag} at ${tick}`, field.getAttribute(attr) === String(flag));
    }
    for (const attr of ['draggable', 'spellcheck', 'contenteditable']) {
      check(`${attr} remains enumerated at ${tick}`, root.querySelector('#enumerated').getAttribute(attr) === String(flag));
    }
    check(`static boolean attributes remain present at ${tick}`, root.querySelector('#static').disabled && root.querySelector('#static').checked && root.querySelector('#static').required);
    check(`hidden until-found remains supported at ${tick}`, root.querySelector('#until').getAttribute('hidden') === 'until-found');
    // Dirty the checked property to exercise explicit property synchronization.
    field.checked = !flag;
  }
  const parse = html => { const template = document.createElement('template'); template.innerHTML = html; return template.content.firstElementChild; };
  for (const value of [false, null, undefined]) {
    check(`quoted ${value} omits native boolean only`, !parse(root.render`<input disabled="${value}" title="${value}">`).hasAttribute('disabled'));
    const unquoted = parse(root.render`<input disabled=${value} required=${true} data-test=${false}>`);
    check(`unquoted ${value} keeps adjacent attributes intact`, !unquoted.hasAttribute('disabled') && unquoted.required && unquoted.getAttribute('data-test') === 'false');
  }
  const multiple = parse(root.render`<input disabled='${false}' checked="${true}" required="${false}" title="safe">`);
  check('multiple omissions preserve remaining attributes', !multiple.disabled && multiple.checked && !multiple.required && multiple.title === 'safe');
  check('string false retains HTML boolean presence semantics', parse(root.render`<input disabled="${'false'}">`).disabled);
  check('nonboolean disabled on a div remains a string', parse(root.render`<div disabled="${false}"></div>`).getAttribute('disabled') === 'false');
  check('no asynchronous errors', errors.length === 0);
  document.querySelector('#result').textContent = JSON.stringify({ results, errors });
}

test('B13: dynamic native boolean attributes and reactive updates in Chrome', async t => {
  const browser = process.env.BAY_TEST_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!existsSync(browser)) return t.skip('Set BAY_TEST_BROWSER to installed Chrome');
  const runtime = browserRuntime(new URL('../bay.mts', import.meta.url));
  const server = createServer((request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' blob:; style-src 'self' blob:");
    response.setHeader('Content-Type', /\.m?js$/.test(request.url ?? '') ? 'text/javascript' : 'text/html');
    if (request.url === '/bay.mjs') return response.end(runtime.module);
    if (request.url === '/distribution.js') return response.end(runtime.classic);
    if (request.url === '/checks.mjs') return response.end(`(${checks.toString()})().catch(error=>{document.querySelector('#result').textContent=JSON.stringify({fatal:String(error),stack:error.stack});});`);
    response.end('<!doctype html><body><pre id="result">pending</pre>' + runtime.script + '<script type="module" src="/checks.mjs"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = mkdtempSync(join(tmpdir(), 'bay-booleans-browser-'));
  try {
    const { stdout } = await promisify(execFile)(browser, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-extensions', '--disable-background-networking', `--user-data-dir=${profile}`,
      '--dump-dom', '--virtual-time-budget=10000', `http://127.0.0.1:${server.address().port}/`,
    ], { timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    const result = /<pre id="result">([\s\S]*?)<\/pre>/.exec(stdout)?.[1]
      .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
    assert.ok(result && result !== 'pending', stdout.slice(-1500));
    const report = JSON.parse(result);
    assert.equal(report.fatal, undefined, JSON.stringify(report));
    for (const result of report.results) assert.equal(result.pass, true, result.name + ': ' + JSON.stringify(report));
    t.diagnostic(`${report.results.length} boolean attribute assertions passed`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    const target = resolve(profile);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('bay-booleans-browser-'));
    rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
