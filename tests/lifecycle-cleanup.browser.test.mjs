// Source-only B4 integration: node --test package/tests/lifecycle-cleanup.browser.test.mjs
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
  window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));
  window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  const check = (name, pass) => results.push({ name, pass: Boolean(pass) });
  const pause = () => new Promise(resolve => setTimeout(resolve, 40));
  const wait = async predicate => {
    for (let i = 0; i < 120; i++) { if (predicate()) return; await pause(); }
    throw Error('Timed out waiting for lifecycle fixture');
  };
  const active = [];
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(name, listener, options) {
    if ((this === window || this === document) && !active.some(item => item.target === this && item.name === name && item.listener === listener)) {
      active.push({ target: this, name, listener });
    }
    return add.call(this, name, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(name, listener, options) {
    const index = active.findIndex(item => item.target === this && item.name === name && item.listener === listener);
    if (index !== -1) active.splice(index, 1);
    return remove.call(this, name, listener, options);
  };
  const NativeObserver = MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    targets = new Set();
    observe(target, options) { this.targets.add(target); return super.observe(target, options); }
    disconnect() { this.targets.clear(); super.disconnect(); }
  };
  const { default: bay } = await import('/bay.mjs'); bay();
  window.calls = { on: 0, directive: 0, props: 0, slot: 0, mounted: 0 };
  const main = document.createElement('lifecycle-main');
  main.innerHTML = '<span id="light">slotted</span>';
  document.body.append(main);
  bay.create('lifecycle-main', `
    <p ref="label" id="count">\${this.count}</p><slot></slot>
    <button id="normal" :click="this.count++">normal</button>
    <button id="once" :click.once="this.count+=10">once</button>
    <span :lifecycle-ping="window.calls.directive++"></span>
    <script props>window.calls.props++;</script>
    <script slotchange>window.calls.slot++;</script>
    <script mounted>window.calls.mounted++;</script>
    <script>
      this.count=1; this.route=$route.path; this.global=$global.value;
      $bay.on('lifecycle-ping', e=>{window.calls.on++; this.received=e.detail.data;});
    </script>`);
  await wait(() => main.shadowRoot?.events && main.shadowRoot.querySelector('#normal') && window.calls.mounted === 1);
  const controller = main.shadowRoot, proxy = controller.proxy, id = main.uniqid;
  const tracked = () => main.managedListeners.filter(entry => entry.target === window || entry.target === document);
  const live = () => tracked().filter(entry => active.some(item => item.target === entry.target && item.name === entry.name && item.listener === entry.listener)).length;
  const registrations = main.managedListeners.length;
  const light = main.querySelector('#light');
  check('slot observer starts active', main.slotObserver.targets.has(light));
  controller.querySelector('#once').click(); await wait(() => proxy.count === 11);
  window.bay.emit('lifecycle-ping', 7);
  check('on and directive each receive one emit', window.calls.on === 1 && window.calls.directive === 1 && proxy.received === 7);
  window.dispatchEvent(main.update_evt);
  check('props hook active', window.calls.props === 1);
  await pause();
  main.remove(); await Promise.resolve();
  check('removed controller registration deleted', window.bay[id] === undefined);
  check('removed global and document listeners released', live() === 0);
  check('removed observer and event bindings released', main.slotObserver.targets.size === 0 && main.eventBindings.length === 0);
  check('pending render frames cancelled', !main.debouncer && !main.mountedFrame);
  const oldSlot = window.calls.slot;
  light.setAttribute('data-detached', 'yes'); controller.dispatchEvent(new Event('slotchange'));
  window.dispatchEvent(main.update_evt); window.bay.emit('lifecycle-ping', 8);
  proxy.count = 50; main.render(); await pause();
  check('removed components stop receiving hooks and emits', window.calls.on === 1 && window.calls.directive === 1 && window.calls.props === 1 && window.calls.slot === oldSlot);
  check('detached state survives without scheduled rendering', proxy.count === 50 && !main.debouncer);
  document.body.append(main);
  await wait(() => controller.querySelector('#count')?.textContent === '50' && main.eventBindings.length > 0);
  check('reconnect restores identical controller and state', window.bay[id] === controller && controller.proxy === proxy && main.uniqid === id);
  check('reconnect restores listeners and observer', live() === tracked().length && main.slotObserver.targets.has(light));
  window.bay.emit('lifecycle-ping', 9);
  check('reconnected emit delivery stays singular', window.calls.on === 2 && window.calls.directive === 2);
  controller.querySelector('#once').click();
  check('reconnect preserves consumed once listener', proxy.count === 50);
  controller.querySelector('#normal').click();
  await wait(() => controller.querySelector('#count').textContent === '51');
  check('ordinary events and refs work after reconnect', controller.refs('label') === controller.querySelector('#count'));
  const container = document.createElement('div'); document.body.append(container);
  container.append(main); document.body.append(main); await Promise.resolve();
  check('temporary DOM moves keep controller active', window.bay[id] === controller && !main.lifecycleSuspended);
  for (let i = 0; i < 3; i++) { main.remove(); await Promise.resolve(); document.body.append(main); await pause(); }
  check('cycles do not duplicate managed registrations', main.managedListeners.length === registrations && live() === tracked().length);
  let renders = 0;
  const render = main.render.bind(main); main.render = () => { renders++; render(); };
  window.dispatchEvent(new Event('bay_global_event')); window.dispatchEvent(new Event('bay_route_event'));
  await pause();
  check('route and global events coalesce into one render', renders === 1);
  check('mounted hook does not repeat', window.calls.mounted === 1);
  await pause();
  const beforeSlot = window.calls.slot;
  light.setAttribute('data-connected', 'yes'); await pause();
  check('reconnected observer delivers once', window.calls.slot === beforeSlot + 1);
  bay.create('lifecycle-early', '<p>\${this.value}</p><script>this.value=42; $bay.on("early-ping",()=>{this.value++});</script>');
  const early = document.createElement('lifecycle-early'); document.body.append(early); early.remove();
  await Promise.resolve();
  await wait(() => typeof early.shadowRoot.template === 'function');
  check('late module completion does not restore removed registration', window.bay[early.uniqid] === undefined && early.lifecycleSuspended);
  document.body.append(early);
  await wait(() => early.shadowRoot.querySelector('p')?.textContent === '42');
  window.bay.emit('early-ping'); await wait(() => early.shadowRoot.querySelector('p')?.textContent === '43');
  check('early removal reconnects with initialized state and one subscription', early.shadowRoot.proxy.value === 43);
  const unattached = document.createElement('lifecycle-early');
  await Promise.resolve();
  await wait(() => typeof unattached.shadowRoot.template === 'function');
  check('never-attached instances release constructor resources', unattached.lifecycleSuspended && window.bay[unattached.uniqid] === undefined);
  document.body.append(unattached);
  await wait(() => unattached.shadowRoot.querySelector('p')?.textContent === '42');
  check('first connection after deferred cleanup initializes normally', window.bay[unattached.uniqid] === unattached.shadowRoot);
  const hydrated = document.createElement('section');
  hydrated.setAttribute('bay-hydrate', '');
  hydrated.innerHTML = '<template><p>${this.message}</p><script>this.message="hydrated & <text>";</script></template>';
  document.body.append(hydrated);
  window.bay.refresh(); window.bay.refresh();
  await wait(() => hydrated.querySelector('p')?.textContent === 'hydrated & <text>');
  const hydrationId = hydrated.id;
  check('hydration output uses safe text in the actual runtime', !hydrated.querySelector('text'));
  window.bay.refresh(); window.bay.refresh();
  check('repeated refresh after template removal retains one controller', hydrated.id === hydrationId && document.querySelectorAll(`[inner-html="#${hydrationId}"]`).length === 1);
  check('no asynchronous errors', errors.length === 0);
  document.querySelector('#result').textContent = JSON.stringify({ results, errors });
}

test('B4: removal, reconnection, moves, observers and subscriptions in Chrome', async t => {
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
  const profile = mkdtempSync(join(tmpdir(), 'bay-lifecycle-browser-'));
  try {
    const { stdout } = await promisify(execFile)(browser, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-extensions', '--disable-background-networking', `--user-data-dir=${profile}`,
      '--dump-dom', '--virtual-time-budget=12000', `http://127.0.0.1:${server.address().port}/`,
    ], { timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    const result = /<pre id="result">([\s\S]*?)<\/pre>/.exec(stdout)?.[1]
      .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
    assert.ok(result && result !== 'pending', stdout.slice(-1500));
    const report = JSON.parse(result);
    assert.equal(report.fatal, undefined, JSON.stringify(report));
    for (const result of report.results) assert.equal(result.pass, true, result.name + ': ' + JSON.stringify(report));
    t.diagnostic(`${report.results.length} lifecycle assertions passed`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    const target = resolve(profile);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('bay-lifecycle-browser-'));
    rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
