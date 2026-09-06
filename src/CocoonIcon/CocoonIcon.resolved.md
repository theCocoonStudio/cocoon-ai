# CocoonIcon — resolved

Built against `CocoonIcon.spec.md` plus the entries below. Test names carry the spec ids.

## contracts

contracts.1: the child under slots.1 is a single `<svg>` element; a fragment or text is rendered as given, unsized — owner caller — tier ④
contracts.2: an error boundary owns exits.throws — owner ancestor — tier ④

## defaults

defaults.1: the artwork's fill is applied as `style`, not as attributes, so it lands in the same place on a named icon and on a cloned child
defaults.2: `size` as a string passes through untouched; no validation of the CSS length, a bad one is the browser's to drop
defaults.3: `icons.js` is generated into `src/CocoonIcon/` by `assets/icons/build.js` and excluded from prettier as generated; the test compares the committed text to a fresh render

## notes

notes.1: jsdom reports `flex: none` as `0 0 auto`; the test asserts `flexGrow`
notes.2: the tests run under jsdom via a per-file `@vitest-environment` comment; the project default stays `node` for the scene and asset tests

## gaps

gaps: none
