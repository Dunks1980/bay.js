# Phase 1B compatibility report

This is the historical Phase 1B report. Release preparation has since regenerated
local distributions and expanded coverage to 61 editor examples. Public CDN
imports remain portable; the offline fixture maps them to real local components.
See [current release notes](../RELEASE_NOTES.md).

Bundled templates and website sources are migrated to the safe defaults in
package/bay.mts. No runtime/core change was needed in this phase.

## Component review

- components/route.mjs now renders a static anchor with an ordinary href binding.
  Copied attribute names are constrained and values encoded before trusting the
  resulting fragment. Authored event handlers stay on the original host/scope,
  rather than being copied into trusted markup. Parent ownership/data markers
  remain on the host. Existing authored light DOM is intentionally trusted.
  Nested clicks navigate using currentTarget.
- components/modal.mjs and components/slide.mjs already use static handler
  expressions and value bindings; no source migration was needed.

## Website migrations

- Sidebar handlers read encoded data attributes instead of compiling loop values
  as JavaScript. SVG icons and generated clock/sort markup use explicit trust.
- Todo/checkbox and drag/drop fragments are fixed application-owned markup.
  Color and form event fragments use fixed allowlists. No user/API content is
  automatically marked trusted. Product and todo injection probes remain text.
- SVG lines use structural tspan elements and encoded text instead of generated
  markup strings. Authored line breaks and whitespace layout are retained.
- Raw-state, encode/decode, props, render-hook and security examples are updated.
  Code samples no longer accidentally encode twice.
- Documentation iframe URLs are assigned through the DOM only after being
  created from owned Blobs. Editor options/content cross into its Blob module as
  JSON data, not interpolated executable source.
- Main app, example loader and runtime component imports use the authoritative
  source preview. Blob-compiled imports use absolute URLs through origin settings.
- bay-source.js serves in-memory TypeScript transformation at /__bay/ during
  Vite development. A later explicitly requested site build can emit those same
  assets. This phase did not run any distribution/production build.
- Displayed CDN installation snippets remain examples; preview execution rewrites
  classic-script URLs to local source. Existing npm metadata/versions are unchanged.

## Validation and limits

22 targeted tests pass: 20 focused security cases, the original Chrome/CSP test
with 23 assertions, and the migration/browser matrix. The matrix covers all 60
editor examples and actual sidebar/editor/docs navigation with 17 interactions,
including nested route clicks, copied attribute breakout, static host handlers,
modal/slide opening, checkbox updates, API text, clock markers and sort arrows.

The browser fixtures use owned localhost servers and temporary profiles. Remote
product and lodash responses are deterministic fixtures. The external CodeMirror
widget is stubbed for site navigation; external CDN availability, native frame
timing, cross-browser behavior and pixel-level appearance are not verified.
CSS/theme files were unchanged. Inactive form prototypes were source-migrated
where relevant; they are not part of the 60 live editor examples.

The original B1/B2 regressions remain enabled and passing. No version, dependency,
publication, deployment, commit or generated distribution was changed. The
pre-existing dist/bay/bay.js submodule status was left alone.

The source migration is ready for an explicitly authorized distribution rebuild,
followed by checking the resulting package/site artifacts. Existing generated
core files still implement the old behavior and must not be mixed with newly
migrated templates. Other audit findings remain outside this phase; this report
is not a blanket release sign-off.

## Files changed in Phase 1B

Package:

- package/components/route.mjs
- package/README.md
- package/tests/SECURITY.md
- package/tests/migration.browser.test.mjs (new)
- package/tests/MIGRATION.md (this report)

Website:

- bayjs.org/bay-source.js
- bayjs.org/codeedit.js
- bayjs.org/component_imports/accordions-docs.html
- bayjs.org/component_imports/accordions-examples.html
- bayjs.org/component_imports/header.html
- bayjs.org/example_code/attributes/prop-data.html
- bayjs.org/example_code/attributes/this-attribute.html
- bayjs.org/example_code/components/modal.html
- bayjs.org/example_code/components/slide.html
- bayjs.org/example_code/examples/clock.html
- bayjs.org/example_code/examples/date_picker.html
- bayjs.org/example_code/examples/drag_drop.html
- bayjs.org/example_code/examples/form_new.html
- bayjs.org/example_code/examples/form_try_2.html
- bayjs.org/example_code/examples/products.html
- bayjs.org/example_code/examples/svg-text.html
- bayjs.org/example_code/examples/table.html
- bayjs.org/example_code/examples/todos.html
- bayjs.org/example_code/functions/decode.html
- bayjs.org/example_code/functions/encode.html
- bayjs.org/example_code/functions/refresh.html
- bayjs.org/example_code/installation/settings.html
- bayjs.org/example_code/lifecycle/lifecycle.html
- bayjs.org/example_code/lifecycle/render.html
- bayjs.org/example_code/router/route copy.html
- bayjs.org/example_code/router/route.html
- bayjs.org/example_code/tags/inner-html-render.html
- bayjs.org/example_code/tags/inner-html.html
- bayjs.org/example_code/tags/slots.html
- bayjs.org/example_code/template/security.html
- bayjs.org/example_code/template/variables.html
- bayjs.org/index.html
- bayjs.org/main.js
- bayjs.org/public/docs/bay-codemirror.html
- bayjs.org/public/docs/bay-iframe.html
- bayjs.org/public/example_bay.js
- bayjs.org/vite.config.js
