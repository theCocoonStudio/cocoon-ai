# AgentSceneGroup — resolved

Written with the run, 2026-10-29, from the spec beside it (cocoon-ai #91, on the owner's decisions of 2026-10-19 and the service half's spec, cocoon-gateway #20) with the amendments the run made to both (the stream's `before` and the renderer's form of each change; the version stamped into the document). The choices the spec left open and the ones the run took are listed for the owner's strike beside Buridan's list (records `claude/notes/2026-10-19-agent-scene-group-choices.md`).

## contracts

- contracts.1: the tunnel's `Out` is mounted in the site's Canvas — owner the page — tier ④ — nothing renders and nothing says so (the demos' contract)
- contracts.2: the Canvas's `frameloop` is `always` — owner the page — tier ④ — under `demand` a value event shows nothing until the page invalidates (frame.invalidate: not needed)
- contracts.3: `stream` and `tunnel` are referentially stable — owner the page — tier ④ — a new stream object resubscribes (harmless), a new tunnel remounts the scene
- contracts.4: the page calls `compile()` when it passes `compile={false}` — owner the page — tier ④ — `onReady` never fires and the materials compile at first draw
- contracts.5: the page sends the handle's `hash`, `backend` and `version` with each request and passes `done`'s document as `document` — owner the page — tier ④ — a stale request is told so by the service (api.6)
- contracts.6: a `change` is applied only when its `before` is the hash held — owner the service's stream — tier ② — a non-following event is dropped and `done` makes the page whole (tested)
- contracts.7: the document's version is the build's — owner the service — tier ② — throws at mount naming both (tested)
- contracts.8: `tones` is exactly the four hex colours — owner the page — tier ② — throws at mount naming the key (tested)
- contracts.9: a required `tunnel` with an `In` — owner the page — tier ② — throws at mount (tested)

## defaults

- defaults.1: the component is two: the outer validates and sends the inner through the tunnel; the inner holds the hooks that need fiber's root state (gl, camera, scene) and the handle, since context does not cross a tunnel (the fluid demo's shape).
- defaults.2: the loaded document's children are added to the group imperatively and disposed by the component (dispose.loaded), not declared as JSX primitives: a loaded tree's geometries and materials are not fiber instances, so fiber would dispose nothing of them.
- defaults.3: a structural change parses the next document, compiles the parsed root off the tree against the Canvas's scene and camera, then swaps the children and disposes the old; the previous objects stay shown meanwhile (states.pending).
- defaults.4: the hash held moves at the event, before a structural swap resolves; a `set` arriving during the swap lands on the objects being replaced and `done` corrects it (the doc's limit; a queue would be the alternative).
- defaults.5: `done` arrives both on the stream and as the page's `document` prop; the second application finds the same nodes and the same values and writes nothing.
- defaults.6: the version is read from `metadata.cocoon.version`, which the service stamps into the template at load; an absent field is another version.
- defaults.7: `backend` reads `gl.backend.isWebGPUBackend`; a renderer without a backend object reads `webgl`.
- defaults.8: the geometries a parameter write can rebuild are the seven listed in apply.js by their constructor's argument order; another class is refused by name (a table that targets one is the service's change).
- defaults.9: an `add` compiles the node alone; a document with other nodes compiles the whole parsed root.
- defaults.10: the fixture is the service's own loop over a scripted model (three turns, eleven changes), recorded from cocoon-gateway agent/first-build and kept at `fixtures/turn.json` with its source in the file; the browser test replays the same events.

## notes

- notes.1: `tones` is validated and otherwise unused here (theme.3: the service composes from them); the prop exists so a malformed set fails at the page before a request carries it. Buridan's 11.
- notes.2: layer 6's loader slot and this spec's `onCompile` callback are the one fork left for the strike (Buridan's X1); the build took the callback.
- notes.3: `state.ready` and `state.pending` render nothing; they are kept as state because the spec names them so, at the cost of a render each.

## gaps

- gaps.1: the spec's tests.3 names "a recorded stream the service's loop test emits"; the field model has no line for a fixture shared across repositories, so its provenance lives in the fixture file and defaults.10.
