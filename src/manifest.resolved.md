# manifest — resolved

Written with the run, 2026-10-18, from the spec beside it (cocoon-ai #84, from Izzy's answers of the same day). The interface is a generated data module and four contracts, so the sections are the ones that apply; the Demo wrapper's amendments are resolved in `src/Demo/Demo.resolved.md`. The defaults are the choices the spec left open, each taken because a wrong one fails loudly, listed for the owner to strike.

## contracts

- contracts.1: a demo file exports `demo`, `schema`, `scene` and `effects` by those names — owner the demo author — tier ② — `src/manifest.test.js` fails on a missing or mis-shaped export, since the entry's field is then undefined.
- contracts.2: a component folder's name is a JavaScript identifier and its `index.jsx` exports it by that name — owner the component author — tier ② — the generator refuses the name; the structure test the export.
- contracts.3: the committed manifest is regenerated after a demo file appears or a doc's front matter changes — owner the author — tier ② — the drift test names the command.
- contracts.4: a scene demo passes `ready` to the wrapper and calls `onReady` once — owner the demo author — tier ② — the fit test's loading case fails when ready never comes.
- contracts.5: the consumer's Canvas fills the viewport and is fixed — owner the consumer — tier ④ — the placement is off (the fluid demo's doc states it).
- contracts.6: the consumer renders a doc's body with a CommonMark renderer of its own and copies `docs/` to where it serves static files (docs.7) — owner the consumer — tier ④ — images and the source link break.

## defaults

- defaults.1: a demo file's facts come through four fixed export names; the generator imports them by name and runs nothing. The spec names what an entry carries, not where the generator finds it.
- defaults.2: the wrapper learns readiness through `ready`, a prop the demo file passes; the loader element renders as given, first in the stage. The spec gives the wrapper the loader and the demo file the handle; this is the line between them (Demo.spec.md props.13, markup.14).
- defaults.3: a demo's `ref` is the handle; the group is `handle.root` (handle.1). A consumer that read the ref as a group breaks loudly.
- defaults.4: the fluid's `compile()` is three's `compileAsync` of the group against the site's scene, then the hook's initialisation steps (`INITIAL_FRAMES`), which compile every pass and write every target. The pass materials stay the hook's and are not in `handle.materials`: handle.2 says every material the scene uses, the simulation's are the hook's, and a consumer cannot compile a bare material list in any case (three compiles objects in a scene), so the batch loading.3 names is each handle's `compile()`.
- defaults.5: credits are names: "Izzy Erlich" and "Claude Fable 5.1" (the owner, 2026-10-18: the current version; the owner updates it as versions change), and the fluid's origin "mnmxmx (fluid-three)". Both names on every component; the split per component is the owner's to correct.
- defaults.6: `since` is the folder's first commit date in this repository.
- defaults.7: `title` is a human title, since `name` already carries the identifier.
- defaults.8: the front matter reader is flat: `key: value` lines, inline `[a, b]` lists, quotes optional, anything else refused naming the line. No YAML dependency: an install needs the vulnerability check first, and a reader that refuses what it cannot read never misreads. Prettier formats the front matter as YAML and the reader accepts its output.
- defaults.9: the drift check and the manifest's checks live in `src/manifest.test.js`, not the structure test, because they import the module; the structure test stays text-only and holds the docs' checks (docs.5).
- defaults.10: `files` ships the whole `docs/` folder, the export docs and the setup page included, since the package is not published (versioning.2); `repository` is set for the source link (docs.9).
- defaults.11: `demos`, every entry and its lists are frozen.
- defaults.12: budgets are the measure with a margin, with the date, in the tests: the chunk at the measure plus a tenth, the ready time at twice the measure.
- defaults.13: the folders' order is byte order (`.sort()`), the same on Linux and macOS.
- defaults.14: `onReady` fires once per demo life; a remount for a `live: false` setting compiles again without the loader.

## notes

- notes.1: `import { demos } from 'cocoon-ai/demos'` carries every demo's code, by loading.1; a route that wants one demo imports it by name from the same entry and the bundler shakes the rest (README, Consuming the package).
- notes.2: the generator writes through prettier's API, so the committed file is the formatted one and the drift test compares formatted text.
- notes.3: the two props every scene demo takes beyond the wrapper's, `compile` and `onReady`, are the demo file's; the wrapper never sees them (Demo.spec.md amend.3).

## gaps

- gaps.1: no markup-only demo exists, so the fit test's case for consumer.1 (no tunnel, no loader, no handle, the Canvas untouched) is skipped, visibly, until one does.
- gaps.2: "a control changes the scene" in the fit test is the sidebar's labels against the schema's visible entries and a change that raises no error; the proof at the pixel is each demo's own browser test.
- gaps.3: effects: the fluid's `effects` is empty and consumer.5's prop does not exist on it (the fluid's resolved gap of 2026-10-07 stands).
- gaps.4: tests.2, the same page against the real consumer, is the owner's step after this run, with the site permission.
- gaps.5: the worker with an OffscreenCanvas named in loading.6 is not built.
- gaps.6: no doc ships an image yet; docs.4's check runs on none.
