# AgentSceneGroup spec: the renderer half of the agent over the home page's scene

Written 2026-10-19 20:48 UTC from records `site/scene-api.md` (layer 6, Claude's proposal for the owner's strike), the service half's spec (cocoon-gateway #20) and the owner's three choices of 2026-10-19 (the words plain and bounded, the scene kept under the cookie, streaming on), the items one by one for the owner's strike. The five proposals of 2026-10-19 07:56 EDT (the name and root; the inputs; a structural change compiles behind a loader, a value change applies in place; the words are the site's markup; the fit test on both backends) are unanswered and stand here marked "Claude's proposal". The theme API is the section the owner asked to be specific (16:5x EDT). Where a line is Claude's call rather than the owner's decision, it says so. The list of every choice nothing forces, Buridan's, with the verdicts, is records `claude/notes/2026-10-19-agent-scene-group-choices.md` (records #92), for the strike beside this file.

## meta

meta.target: portable
meta.runtime: client
meta.file: src/AgentSceneGroup/index.jsx
meta.kind: scene component; the home page's scene, sent through the site's tunnel into its one Canvas the way a demo's scene is (manifest.spec consumer.1); not a manifest entry, since it is the page and not a demo (a demo of it is a later demo, manifest.spec scope.3). Claude's proposal: the name by the skill's rule, the three class its root renders.

## imports

imports.1: import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
imports.2: import { useThree } from '@react-three/fiber'
imports.3: import { NodeObjectLoader } from 'three/webgpu' — the loader that unpacks the service's document, node materials included (three 0.184 exports it from the webgpu build; verified 2026-10-19)
imports.4: from ./apply.js — the pure part (library.helper): the index of a loaded group by the table's paths, an event applied to it, the diff of two documents by node set

## props

props.1: document — object, required; the representation the service composed (the three document at props.2's version, carried in `metadata.cocoon.version`, which the service stamps into the template at load: a gateway #20 amendment, scene.4), replaced whole at each turn's `done` and after a theme switch (theme.5); never written by the page
props.2: version — none as a prop: the representation's version this build reads is a constant of the module, exposed on the handle (handle.6) for the page to declare at layer 2 (records site/scene-api.md: the version is read from the renderer at page load); a document whose version differs throws (exits.throws). Corrected 2026-10-19 after Buridan's X2
props.3: hash — string, required; the service's hash of props.1, so the component hashes nothing (one hasher, the service's; Claude's call)
props.4: stream — `{ subscribe(listener): unsubscribe }`, optional, referentially stable; the turn's events as the service emits them (gateway #20 stream.1), read imperatively (refs.1); absent between turns
props.5: tunnel — the site's tunnel, required; its Out sits in the site's Canvas; the component never renders a Canvas (Claude's proposal, as the demos)
props.6: tones — `{ ink, surface, ground, accent }`, required (theme.1)
props.7: compile — boolean, optional, default true; compile on mount; false when the page calls handle.3 itself, the home page's batch over every scene's materials (manifest.spec loading.3)
props.8: onReady — () => void, optional; once, when the first compile resolves (callbacks.1)
props.9: onCompile — (pending: boolean) => void, optional; true when a structural event starts a compile, false when it resolves (callbacks.2), so the page shows its own loader; the home page's loader is global (manifest.spec loading.2), so no loader element here. Claude's proposal; the fork with layer 6's own words ("a loader slot shown while a structural change compiles"): a `loader` element the component shows in place, as the demos do (Demo.spec props.10), against this callback the page's loader follows; both texts are mine, one for the strike (Buridan's X1)
props.passthrough: none
props.ref: handle

## slots

slots.mechanism: none
slots.1: none; the agent's words are the site's markup beside the scene, a text node the site writes (gateway #20 words.4); the component never renders them. Claude's proposal.

## context

context.consumed: fiber's root state: gl, camera, scene
context.provided: none

## state

state.1: ready — boolean, initial false; true when the first compile resolves
state.2: pending — boolean, initial false; a structural change compiling
state.3: none else that renders; the scene's hash and the path index live in refs
state.reset: a `document` whose node set differs from the loaded one (effects.1) resets the path index and re-arms handle.3

## markup

markup.1: no DOM; `<tunnel.In><group ref={root}>` with the loaded document's objects as children; nothing is wrapped around them
markup.2: the document's scene-level properties, its background and fog, are applied to the Canvas's scene while mounted and restored on unmount, since a Group has neither and the home page's scene is the Canvas's. Claude's call.
markup.3: a node of the WebGPU-only tier is present only when the Canvas's backend is WebGPU (handle.5; the document the service composed for a `webgl` client holds none)

## states

states.default: markup.1–3, state.1 true, the stream applied as it arrives
states.pending: state.2 true, props.9 called with true; the previous objects stay shown until the new compile resolves, then the swap; no flash. Claude's call.
states.empty: never; the page starts at the template (gateway #20 api.4) and mounts the component with it
states.error: exits.throws

## callbacks

callbacks.1: onReady — fires once, after the first compile resolves, whether props.7 or handle.3 started it
callbacks.2: onCompile — fires with true at a structural event (`add`, `remove`, or a `document` whose node set differs) and with false when that compile resolves; never for a value event
callbacks.neg.1: nothing fires for an event whose hash does not follow the scene's current hash (effects.3)

## effects

effects.1: `document` change → the diff by node set (apply.js): equal sets, the values applied in place by path with no compile (a colour, a number, a boolean, a vector); different sets, the document loaded into a fresh group by imports.3, compiled (handle.3's promise, re-armed), swapped in when ready, the old group disposed (dispose.loaded); the hash taken from props.3
effects.2: a `change` event (gateway #20 stream.1, amended 2026-10-29 by this build's pre-flight, since the page holds no table): `set` carries `writes`, the path's targets as JSON pointers into the document with the encoded values, applied in place by pointer (a colour set, a number assigned, a geometry rebuilt from its parameters, the background and fog onto the Canvas's scene); `add` carries `node`, the composed node, and `pointer`, its slot's array: parsed by the loader, appended and compiled behind callbacks.2; `remove` carries `uuid` and `pointer`: the node taken out and disposed; `undo` and `reset` carry `document`, the whole, applied as effects.1; `done` is the whole document and is applied as effects.1 (a page that missed an event is made whole)
effects.3: a `change` whose `before` (the hash it applied to; the same amendment) is not the hash held here is dropped (stream.3 of #20); a whole document (`done`, `undo`, `reset`) always applies
effects.4: `tones` change alone does nothing here: the page sends the service the new tones and passes the returned document (theme.5); the component never composes

## exits

exits.throws: at mount when `tunnel` is absent or has no `In`; when `tones` is not four hex colours (theme.1); when `document`'s version is not the build's (props.2); when the loader refuses the document (the service validated it; a failure here is a bug, not caught)
exits.suspends: never
exits.handler-failures: a stream listener that throws propagates; not caught

## refs

refs.1: stream — props.4, subscribed in an effect, unsubscribed on change or unmount; an event never renders by itself (a structural one sets state.2)
refs.2: root — internal, the group
refs.3: index — internal, the document's mirror and the live objects it names by uuid and position, built at each load and kept in step by every write, so a pointer from the service lands on the right object (apply.js `SceneIndex`; the spec's earlier `byPath` by the table's paths, which the page does not hold)
refs.4: hash — internal, the scene's current hash, written at props.3 and after each applied event

## handle

handle.1: root — the group, for the site to traverse or raycast
handle.2: materials — every material the loaded document uses, so the home page compiles in a batch with the demos' (manifest.spec loading.3)
handle.3: compile() — three's `compileAsync` of the group against the Canvas's scene and camera; one promise, idempotent, re-armed after a structural load
handle.4: hash — the scene's current hash, for the page to send with the next request (layer 2)
handle.5: backend — 'webgpu' | 'webgl', read from the renderer (`gl.backend.isWebGPUBackend`), for the page to declare at layer 2
handle.6: version — integer, the representation's version this build reads (props.2), for the page to declare at layer 2

## frame

frame.mode: none — nothing per frame; the scene changes by events, not by time. Claude's call: an animated template (a slow rotation, a breathing light) is a later addition behind a `frame` prop, not this spec's.
frame.args: none
frame.tunnel: none
frame.writes-react: never
frame.invalidate: not needed
frame.sync.1: none

## dispose

dispose.loaded: every geometry, material and texture the loader created — on a structural reload (the old group) and on unmount
dispose.node: a node `remove`d — at the event
dispose.after: the group empty; the Canvas scene's background and fog restored to what they were before mount (markup.2)

## bridge

bridge: none

## library

library.export: named `AgentSceneGroup` from src/index.js; not from the demos entry (the home page imports it directly). Claude's call.
library.side-effects: none
library.helper: src/AgentSceneGroup/apply.js — pure: the index by path, an event applied, the diff by node set; tested without GL (tests.1)
library.generated: none
library.script: none

## theme (the owner, 2026-10-19 16:5x EDT: "let's be a bit more specific about theme api in the spec")

theme.1: `tones` — object, required: `{ ink, surface, ground, accent }`, each a hex colour `#RRGGBB` (the table's colour kind), the library's own tone names (cocoon.config.js: `ink` and the cuts' `ground`; `surface` is what HazePlanes and CocoonLogoGroup call the tone their copies fade from, docs/HazePlanes.md, docs/CocoonLogoGroup.md) plus `accent`; anything else throws at mount (exits.throws). Claude's call: four tones, not a theme name, so the scene holds no palette of its own and the site's CSS custom properties stay the one source (the site reads them off its `data-theme` root and passes the four)
theme.2: what each tone paints, by the table's themed paths (scene.json marks a path `themed: "<tone>"`; an amendment to gateway #20 scene.1): `ground` → the scene's background and the fog's colour; `ink` → the main material's colour; `surface` → the main material's emissive; `accent` → the default colour of a node the agent adds (a light's). A path not marked themed is the template's whatever the tones
theme.3: the tones travel with every request (layer 2 carries them beside the backend and the version; layer 3 validates four hex colours or answers 400; amendments to #20 api.2 and scene.3) and the service composes the base from them, so `read()` shows the agent what the page shows and the hash covers the tones; the renderer composes nothing. Claude's call, against a client-side overlay the agent could not see
theme.4: precedence: a path the agent has set keeps the agent's value; a path it has not set follows the tones; the template's default holds when neither; the service's state knows which paths the agent set, the renderer need not
theme.5: a theme switch on the page is a request with the new tones and no prompt (`PUT /v1/scene/:clientId/tones`, an amendment to #20 api.*: no model call, the untouched paths re-based, the document and its hash returned); the page passes the returned document as props.1 and the component applies it in place as value changes (effects.1), no compile, no loader; one round trip, never a model call
theme.6: the agent's words, the page's loader and everything else in the DOM are the site's markup and follow the site's CSS; the component renders no DOM and reads no CSS
theme.7: a snapshot (gateway #20 store.5) is the document at its hash with the tones it was composed under; opened under another theme it shows as it was, and the visitor's first turn or theme switch re-bases its untouched paths. Claude's call: a snapshot is a picture
theme.8: the Demo wrapper's `theme` string (Demo.spec props.8, `data-theme`) is unchanged and is not this component's; the home page's scene is not wrapped; a later demo of this component takes both

## tests

tests.1: apply.js, no GL (vitest): the index over a loaded fixture, resolving pointers by the mirror's uuids; every write of the recorded turns (a colour, a number, a fog, a size, a boolean); `add` from a fragment and `remove` by uuid; the diff by node set and the writes between two documents of one set; the refusals by name (the non-following hash is the component's test, tests.2, since the index never sees a hash)
tests.2: the test renderer (@react-three/test-renderer, mocked GL): mounts, through a tunnel, with a fixture document composed for the test's tones (the service composes, the component applies nothing: effects.4); the handle's six members; the group's children match the document's and the fixture's themed values sit on the loaded objects; a version mismatch, a malformed `tones` and a missing tunnel throw; dispose on unmount. Corrected 2026-10-19 after Buridan's X4
tests.3: the fit test (src/test/browser.js, both backends): the consumer-shaped page of manifest.browser-entry.jsx mounts the component through the tunnel with the template document and a recorded stream (the fixture the service's loop test emits, gateway #20 loop.8, the same events), asserts the scene's state after each event and at `done`, onReady once, onCompile in pairs on structural events, a value event visible within one frame, and the compile time against the budget. Claude's proposal.

## budget

budget.1: the template's first compile under a budget recorded at the first run on the harness's Chromium and sized for GitHub's runner (twice the slowest run seen, as the harness sizes every timeout), the number and its date in the test
budget.2: a value event applied within one frame, no compile, asserted in tests.3 by reading the property after the event

## versioning

versioning.1: the document's version is the service's (gateway #20 versioning.1); this component reads one version and throws on another; the stream's event shapes and the tones' four names are the contract across both halves, a change a major version by the package's rules

## out of scope

scope.1: the Next backend, the cookie, the rate limiting and the refusal counts (records site/scene-api.md, layer 2)
scope.2: the agent's words' markup and the page's loader (the site's)
scope.3: the service, the tools, the table and the store (gateway #20)
scope.4: a demo of this component for the demos page (manifest.spec scope.3)
