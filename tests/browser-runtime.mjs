// Shared runtime selection for source regressions and release artifact checks.
// BAY_TEST_DISTRIBUTION selects an existing file; no build runs in this helper.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from '../../bayjs.org/node_modules/esbuild/lib/main.js';

export function browserRuntime(source) {
  const file = process.env.BAY_TEST_DISTRIBUTION;
  if (!file) {
    return { module: transformSync(readFileSync(source, 'utf8'), {
      loader: 'ts', target: 'es2020', format: 'esm',
    }).code, script: '', classic: null };
  }
  assert.ok(['bay.mjs', 'bay.js', 'bay.min.mjs', 'bay.min.js'].includes(file));
  const code = readFileSync(new URL(file, source), 'utf8');
  if (file.endsWith('.mjs')) return { module: code, script: '', classic: null };
  return {
    classic: code,
    script: '<script src="/distribution.js"></script>',
    // The actual classic asset initializes via the script tag above. This
    // adapter lets the shared checks call its already initialized public APIs.
    module: 'const bay=()=>{}; bay.create=window.bay.create; bay.refresh=window.bay.refresh; export default bay;',
  };
}
