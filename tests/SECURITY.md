# Phase 1: safe-default migration (unreleased source)

Option 1 was approved. Runtime changes apply to `package/bay.mts` and the
regenerated local classic/ESM/minified distributions. Component/website sources
are migrated. Version 4.0.0 is prepared locally; nothing has been published.
Existing published builds do not gain these protections until a release.

## Output and state

Reactive strings are stored raw, including collection assignments. Reassigning
state no longer encodes it again. Ordinary interpolation encodes text and
attribute values at output, including nested values and function results.

```html
<p>${this.user.name}</p>
<input value="${this.user.name}">
<script>this.user = { name: 'A&B <example>' };</script>
```

Do not pre-encode data for ordinary interpolation. Applications depending on
encoded state reads or serialization must migrate. `encode` and `decode` remain
string utilities; neither grants HTML trust. Their results are encoded on output,
so explicitly calling encode can intentionally display entity notation.
Null state reads now preserve `null`; undefined/missing reads retain the existing
empty-string fallback. Nullish values render as empty ordinary text; zero and
false render as `0` and `false`.

The compiler uses a native template tag to separate trusted template text from
expression values. The JS engine handles expressions, nested template literals,
and regexes. Structural directives render their children through the same tag
before trusting the generated structure. Light DOM and select binding also use
safe output boundaries. JSON props are encoded once on output and `$prop` parses
them without another entity-decoding pass. Attribute inspection no longer
constructs custom elements or writes dummy prop values.

## Trusted HTML

Use `$bay.html(value)` for intentionally trusted markup:

```html
<section>${$bay.html(this.trustedMarkup)}</section>
<script render>return $bay.html('<strong>Trusted application markup</strong>');</script>
```

The helper captures a string in an immutable, module-branded value. Matching
object properties cannot forge that brand. `window.bay.html(value)` is available
after initialization, and branded values can be stored in reactive state.

**This does not sanitize HTML. Never grant trust to untrusted user/API content.**
Trusted markup can contain active HTML, resources, and executable directives.

Previously `${$bay.decode(value)}` could render HTML implicitly. It now renders
text. For deliberately encoded, trusted markup, use
`${$bay.html($bay.decode(value))}`. For raw trusted markup, use html directly.
Plain strings returned by `<script render>` are text unless explicitly trusted.
Phase 1B migrates the bundled route component and website examples. The route
keeps href as an ordinary URL binding and encodes copied attribute values;
only existing authored light-DOM content and constrained attribute fragments
are trusted. Website development serves authoritative source in memory through
`/__bay/`; local package distributions now contain the same fixes.

## Event migration

```html
<!-- Before: now rejected -->
<button :click="this.pick('${this.name}')">Pick</button>
<!-- After: runtime data never becomes handler source -->
<button :click="this.pick(this.name)">Pick</button>
```

In loops, use a data attribute instead of interpolating into code:

```html
<map array="this.items" params="item">
  <button data-name="${item.name}"
          :click="this.pick(e.currentTarget.dataset.name)">Pick</button>
</map>
```

Legacy source interpolation fails with a Bay template security error for ordinary
and malicious values alike. It fails before the generated handler is compiled;
existing render error handling reports it. Fix the template rather than relying
on partial content. Static handlers, custom events, and modifiers keep their
syntax and the existing Blob-module execution path. Trusted templates remain
executable application code.

## Attribute fragments and other contexts

`this-attribute` retains explicit trusted attribute fragments and the empty
string for no attributes:

```html
<button this-attribute="this.trustedAttributes">Pick</button>
<script>this.trustedAttributes = $bay.html('aria-label="Trusted label"');</script>
```

Prefer `aria-label="${this.label}"` for data. Non-empty untrusted strings in
HTML-syntax positions now fail closed. Trusting attribute fragments is as
powerful as trusting HTML: the complete fragment must be trusted, including any
handler source it contains. A trusted wrapper inside an ordinary attribute value
still gets encoded, and cannot bypass the dynamic-handler rejection.

Dynamic tag/attribute names, comments, script/style text, native `on...` values,
`srcdoc`, `srcset`/`imagesrcset`, and resource attributes on script/object/embed/base
are rejected. Separate component-script and stylesheet compilation remain
trusted-code paths. Dynamic CSS is not sanitized.

Known URL attributes (`href`, `xlink:href`, `src`, `action`, `formaction`, `poster`,
`cite`, `background`, `data`, `codebase`) validate the completed dynamic value,
after entity decoding and control/whitespace normalization. Relative URLs and
HTTP(S), mailto, tel, and FTP schemes are allowed. Other explicit schemes,
including javascript/data/vbscript, are rejected, including split schemes across
literal/expression boundaries. This is not an origin or authorization policy;
applications must validate allowed destinations themselves.

## Verification

From the workspace root:

```sh
node --test package/tests/security.test.mjs
node --test package/tests/security.browser.test.mjs
node --test package/tests/migration.browser.test.mjs
tsc --project package/tsconfig.json --noEmit
```

No new framework/dependency is needed. The tests use Node's runner, existing
website esbuild/parse5 development installations, and in-memory transpilation of
the authoritative source. They require those existing development tools; they
are not yet a standalone npm-package test setup.

- 24 focused tests cover B1/B2/B7, ordinary/nested state, quotes, entities, repeated
  updates, trusted HTML, event modifiers, attribute breakout, sensitive contexts,
  and URL schemes.
- One Chrome integration test executes 23 assertions through the real compiler,
  DOM, Blob imports, nested props/components, loops, conditionals, switch,
  bindings, light DOM, and updates under `script-src 'self' blob:` and
  `style-src 'self' blob:`. It checks legacy-handler rejection and unexpected
  asynchronous errors.
- Chrome uses a localhost-only server and disposable temporary profile. Set
  `BAY_TEST_BROWSER` for another Chromium path; the test skips without a browser.
  Timer-backed frames are used because dump-dom virtual time stalls compositor
  frames. Native frame timing is not covered. Browser launch may need execution
  outside a restricted process sandbox.
- TypeScript no-emit checking passes with an already installed compiler.
- The Vite/Chrome matrix checks all 61 editor examples and
  actual website navigation, with 17 interaction assertions. Product/lodash
  responses are deterministic fixtures; the external CodeMirror widget is stubbed
  for the site navigation check. Native frame timing and external editor/CDN
  availability are not validated. No production build is run.

B1/B2 reproduced before implementation. Tests now exercise the output tag.
Legacy-handler cases assert rejection and no injected effects. Intentional HTML
requires explicit trust, and decode alone is asserted to remain text. Security
assertions were not changed to accept injection.

## Remaining limits

Templates, includes, settings substitutions, scripts, styles, imports, and
explicit trusted HTML remain trusted application inputs. This is not a general
HTML parser/sanitizer, JavaScript sandbox, Trusted Types integration, URL-origin
policy, or CSS sanitizer. It protects ordinary interpolation in supported HTML
contexts and rejects unsupported dynamic syntax. Other browsers still need
coverage. See [release notes](../RELEASE_NOTES.md) for the other audit fixes,
distribution validation and compatibility considerations.

No eval/new Function, runtime dependency, or CSP relaxation was introduced.
Existing Blob script/style requirements remain in effect.
