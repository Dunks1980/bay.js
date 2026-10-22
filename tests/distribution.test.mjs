// Verify existing artifacts in memory; this test does not write build outputs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from '../node_modules/typescript/lib/typescript.js';
import { minify } from '../node_modules/terser/main.js';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const normalize = code => code.replaceAll('\r\n', '\n').trimEnd();

test('release distributions match the authoritative source and established compiler settings', () => {
  const config = JSON.parse(read('tsconfig.json'));
  const options = ts.convertCompilerOptionsFromJson(config.compilerOptions, '.');
  assert.equal(options.errors.length, 0);
  const expected = ts.transpileModule(read('bay.mts'), { fileName: 'bay.mts', compilerOptions: options.options }).outputText;
  assert.equal(normalize(read('bay.mjs')), normalize(expected));
  assert.equal(normalize(read('bay.js')), normalize(expected.replace('export default bay;', 'bay();')));
  for (const marker of ['trusted_html', 'hydrated_targets', 'lifecycleSuspended', 'onceListeners', 'dispatch_emitted', 'pending_registrations', 'booleanAttributeProperty']) {
    assert.ok(read('bay.mjs').includes(marker), 'Missing audited implementation: ' + marker);
  }
});

test('minified distributions match the established Terser settings', async () => {
  await Promise.all(['js', 'mjs'].map(async extension => {
    const expected = await minify(read('bay.' + extension), { compress: true, mangle: true });
    assert.equal(normalize(read('bay.min.' + extension)), normalize(expected.code));
  }));
});
