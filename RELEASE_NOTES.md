# Bay.js 4.0.0 release preparation

Prepared version: **4.0.0**. Safe interpolation defaults require migration
of templates that previously rendered strings as HTML or interpolated data into
executable handlers. The manifest and local lockfile metadata are set to 4.0.0.
Publication, tagging, pushing and deployment are separate steps and have not
been performed.

## Compatibility and migration

- State strings remain raw; ordinary text and attribute output is encoded once,
  including nested values. Remove pre-encoding intended to compensate for old
  state encoding. Existing encoded strings display their entity notation.
- Intentional trusted HTML requires `$bay.html(markup)`. `decode()` alone and
  plain render-script strings produce text. This is not sanitization: never
  brand untrusted user/API content. Templates, includes, scripts, settings and
  trusted HTML remain application-controlled inputs.
- Replace `:click="this.pick('${this.name}')"` with
  `:click="this.pick(this.name)"`. In loops, carry data in ordinary attributes and
  read `e.currentTarget.dataset`. `this-attribute` fragments need explicit trust.
  Unsupported executable/resource contexts and unsafe URL schemes are rejected.
  Existing Blob script/style CSP requirements remain.
- Dynamic native boolean false/nullish values remove the attribute; true restores
  it. The string `"false"` remains present, following HTML semantics. ARIA/data
  and enumerated attributes retain strings. Null reads now preserve null;
  missing/undefined reads retain the empty-string fallback.
- `$ref()` is limited to the owning host, shadow root and explicit inner-HTML
  target. Nested component interiors and other instances are excluded. Matches
  are deduplicated; element/array/missing-reference return types remain.
- Disconnection releases Bay-managed subscriptions, observers, bindings, frames
  and global controller registrations after a microtask. Same-turn moves remain
  active. Reconnection restores state and subscriptions without duplication.
  Detached components stop receiving global subscriptions. Application-created
  native listeners, timers and observers remain application-managed.
- `.once` stays consumed for a surviving element/directive across renders and
  reconnections; new elements or recreated directives start fresh. Emitted events
  deliver once per recipient, with existing payloads and non-bubbling flags.
  Props and slotchange hooks remain independently subscribed.
- Hydration is scoped and idempotent, with stable generated IDs. Missing
  templates are skipped and may be discovered later. Initialization after load
  still discovers components.
- Different tags can share a template URL. In-flight requests are shared; failed
  requests retry on later discovery. Successful top-level templates are cached
  for the runtime, and each tag still has one definition.
- Nested includes resolve against the page base, preserving existing relative
  URL semantics. Styles stay local to compilation and follow template order.
  Failed/circular branches are logged and omitted so compilation can complete.
- Map/Set wrappers have stable identities, compatible native methods and
  chaining. Existing set/add notifications remain. Delete/clear, mutations inside
  collection values and Date mutations do not notify; reassign the state property
  to request an update. Date remains native and unproxied.
- npm main/module resolve to `bay.mjs`. File and component subpaths remain.
  Classic script tags must explicitly name `bay.js` or `bay.min.js`. There is no
  CommonJS build: dynamic import works, while synchronous require is not portable.
  Node 24.22.0 returns a namespace containing `.default`. Initialization still
  requires a browser DOM.

## Build and verification

Final validation: 81 package tests passed with no skips or failures, including
61 editor examples and 17 website interaction checks. The four-distribution
Chrome matrix passed 12 scenarios containing 496 assertions (124 per artifact),
covering safe output, lifecycle cleanup, repeated hydration, events and boolean
attributes. TypeScript no-emit checking and exact artifact parity checks pass.
No runtime source correction was needed during release preparation: the only
initial suite failures were stale example-count/CDN fixture assumptions.

The established build emits TypeScript using `tsconfig.json`, then runs
`node minify.js` to derive the classic script and invoke installed Terser. All
four local files are regenerated: `bay.mjs`, `bay.js`, `bay.min.mjs`, `bay.min.js`.
No build-system redesign or runtime dependency was added.

From the workspace root:

```powershell
node --test package/tests/*.test.mjs
node package/node_modules/typescript/lib/tsc.js --project package/tsconfig.json --noEmit
```

For each artifact filename, set `BAY_TEST_DISTRIBUTION` and run the security,
lifecycle-cleanup and boolean-attributes browser tests. Without that variable,
they use authoritative source. Classic artifacts load via real script tags;
ESM artifacts are imported. Artifact parity tests compare generated output with
the established TypeScript/Terser settings in memory without writing outputs.

The matrix exercises all 61 website examples and navigation with local component
imports and deterministic product/lodash responses. External CDN availability
and CodeMirror are not validated. Chrome fixtures use timer-backed frames;
native compositor timing, other browsers and pixel-level appearance are outside
this verification. No website build was run.

Package tests verify bare imports, bundler main/module resolution, every bundled
component and explicit file paths. `npm pack --dry-run --ignore-scripts --json`
checks contents without creating a tarball. An explicit manifest allowlist ships
only the four distributions, three public components, favicon, README, licence
and these release notes (plus npm's automatically included package.json).
Tests, TypeScript source, build tools and fixtures remain in the development
checkout and are excluded from publication. Running the tests above requires
that checkout and its development tools. Published CDN examples still use the
previous published release until 4.0.0 is explicitly published.
