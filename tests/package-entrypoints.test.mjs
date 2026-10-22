// Run: node --test package/tests/package-entrypoints.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import { build } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const name = '@dunks1980/bay.js';

async function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'bay-entrypoints-'));
  const installed = join(root, 'node_modules', '@dunks1980', 'bay.js');
  mkdirSync(installed, { recursive: true });
  try {
    // Test the existing distribution without rebuilding or editing it.
    for (const path of ['package.json', 'bay.js', 'bay.mjs', 'bay.min.js', 'bay.min.mjs', 'components']) {
      cpSync(join(packageRoot, path), join(installed, path), { recursive: true });
    }
    await callback(root, installed);
  } finally {
    const target = resolve(root);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('bay-entrypoints-'));
    rmSync(target, { recursive: true, force: true });
  }
}

test('B3: bare ESM import resolves to the default export from bay.mjs', async () => fixture(async root => {
  const probe = join(root, 'probe.mjs');
  writeFileSync(probe, `
    import bay from '${name}';
    import explicit from '${name}/bay.mjs';
    import minified from '${name}/bay.min.mjs';
    console.log(JSON.stringify({ type: typeof bay, same: bay === explicit,
      minified: typeof minified, resolved: import.meta.resolve('${name}') }));
  `);
  const report = JSON.parse(execFileSync(process.execPath, [probe], { encoding: 'utf8', windowsHide: true }));
  assert.equal(report.type, 'function'); assert.equal(report.same, true);
  assert.equal(report.minified, 'function'); assert.ok(report.resolved.endsWith('/bay.mjs'));
}));

test('B3: browser bundlers resolve the ESM entry using module or main', async () => fixture(async root => {
  for (const mainFields of [['browser', 'module', 'main'], ['main']]) {
    const result = await build({
      stdin: { contents: `import bay from '${name}'; export default bay;`, resolveDir: root },
      platform: 'browser', format: 'esm', bundle: true, write: false, metafile: true, mainFields,
    });
    assert.ok(Object.keys(result.metafile.inputs).some(path => path.endsWith('/bay.mjs')));
    assert.ok(!Object.keys(result.metafile.inputs).some(path => path.endsWith('/bay.js')));
  }
}));

test('B3: all shipped component subpaths and direct browser asset paths remain available', async () => fixture(async (root, installed) => {
  const components = readdirSync(join(installed, 'components')).filter(path => path.endsWith('.mjs'));
  assert.ok(components.length > 0);
  const probe = join(root, 'subpaths.mjs');
  writeFileSync(probe, `
    const components = ${JSON.stringify(components)};
    for (const component of components) {
      const mod = await import('${name}/components/' + component);
      if (typeof mod.default !== 'string') throw Error(component + ' lost its template export');
    }
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    for (const file of ['bay.js', 'bay.min.js', 'bay.mjs', 'bay.min.mjs', 'package.json']) {
      require.resolve('${name}/' + file);
    }
    console.log(components.length);
  `);
  assert.equal(Number(execFileSync(process.execPath, [probe], { encoding: 'utf8', windowsHide: true })), components.length);
}));

test('B3: classic browser scripts still initialize window.bay without module exports', () => {
  for (const file of ['bay.js', 'bay.min.js']) {
    const listeners = new Map();
    const window = {
      location: { pathname: '/', search: '', href: 'https://example.test/' },
      addEventListener: (name, callback) => listeners.set(name, callback),
      requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    };
    vm.runInNewContext(readFileSync(join(packageRoot, file), 'utf8'), {
      window, document: { querySelectorAll: () => [], createElement: () => ({ innerHTML: '' }) }, URLSearchParams, crypto: globalThis.crypto,
    });
    assert.equal(typeof window.bay, 'object', file);
    assert.equal(typeof window.bay.create, 'function', file);
    assert.equal(typeof window.bay.refresh, 'function', file);
    assert.equal(typeof listeners.get('load'), 'function', file);
  }
});

test('B3: CommonJS dynamic import works; synchronous require behavior is reported explicitly', async t => fixture(async root => {
  const probe = join(root, 'commonjs.cjs');
  writeFileSync(probe, `
    (async () => {
      const imported = await import('${name}');
      let required;
      try {
        const value = require('${name}');
        required = { type: typeof value, defaultType: typeof value.default, same: value.default === imported.default };
      } catch (error) { required = { code: error.code }; }
      console.log(JSON.stringify({ imported: typeof imported.default, required }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  const report = JSON.parse(execFileSync(process.execPath, [probe], { encoding: 'utf8', windowsHide: true }));
  assert.equal(report.imported, 'function');
  if (report.required.code) assert.equal(report.required.code, 'ERR_REQUIRE_ESM');
  else {
    assert.equal(report.required.type, 'object');
    assert.equal(report.required.defaultType, 'function'); assert.equal(report.required.same, true);
  }
  t.diagnostic(`${process.version} synchronous require result: ${JSON.stringify(report.required)}`);
}));
