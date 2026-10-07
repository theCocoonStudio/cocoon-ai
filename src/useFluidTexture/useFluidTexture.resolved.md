# useFluidTexture — resolved

Written with the port to TSL, 2026-10-06, against the retroactive spec beside it.

## Decisions

- **Renderer.** The hook requires the WebGPU renderer (`three/webgpu`), on either of its backends. The legacy renderer cannot build node materials, so the hook throws at mount with the Canvas setup named (exits.throws). Tested in the unit tests with fiber's `gl` option marking the test renderer's mock.
- **The force accumulates.** The WebGL version rendered the force pass with autoClear on, so the renderer cleared the target advection had just written and the fluid had no memory between frames; what looked like memory was the pressure solve's warm start. Found on 2026-10-06 while porting, measured on the legacy renderer: an opaque 0.5 then an additive 0.25 read back 0.25 with autoClear on and 0.75 with it off. The first fix rendered the two force passes with autoClear off and restored it, the pattern drei's View and three's own blit use; Izzy's review asked for no renderer state inside the hook at all, and the second version has none (frame.3): the pointer force is folded into the advection fragment, which removes the blended pass and a draw per step, and the mesh force draws into a target of its own, allocated only while a mesh is given and cleared through the renderer's manual clear. Every pass writes every texel of its target or clears it, so autoClear is never read or written, and the unit tests assert that in both force modes. The browser test "the flow persists after the force stops" holds the fix. The fold differs from the old force quad only at the canvas's top-right edge, where the quad was clamped and the bump squashed (Izzy's review, 2026-10-07).
- **Explicit sample coordinates flip y.** The renderer stores a render target's rows top first and a texture node flips y for it only at its default uv. Every pass samples at a computed coordinate, so `tsl/common.js` flips there and the GLSL's y-up maths is kept as it was. Found when the port diverged from the WebGL version at step six under a sustained force: every pass read its input mirrored, invisible on the symmetric test fields except for a one-texel offset that fed the odd-even mode of the two-cell Jacobi stencil. The browser test "a force above the centre darkens the top" holds it.
- **Defaults live in cocoon.config.js** under `fluid`, read as a whole; the hook merges options over them, an undefined option not overriding.
- **drei is gone.** The targets are three's own RenderTarget through `targets.js`; nothing else in the package used drei, so it left the peer dependencies.
- **The picture is written for a `map`.** The output pass samples velocity unflipped so the returned texture is upright through a material's `map`, verified against a screenshot on both backends; a first version flipped like the other passes and showed the force above the centre at the bottom, and the browser test passed only because the WebGL backend's readback is itself bottom-first. The test image is now ordered per backend and checked against the screen.
- **Cameras.** The passes use an identity-extent orthographic camera, not three's bare `Camera`: the WebGPU backend adapts every camera's projection to its clip space and calls a method the bare class lacks.
- **Half float, two channels** for the fields, as before. The walls are node materials on line segments, bound by name to the input they copy.

## Gaps, declared

- The WebGPU backend is tested under SwiftShader's Vulkan, not on a GPU: the harness flags (`src/test/browser.js`) give headless Chromium an adapter, and the browser suite runs every scenario on both backends, which agree to the grey level (2026-10-06). A real GPU is Izzy's on-site run.
- The browser tests' numbers were measured on Linux under SwiftShader; a GPU may land on different greys within the asserted margins.
- The orientation of `fields.*` for a consumer: through a texture node at its default uv they display upright (measured); through an explicit coordinate they need the same flip the passes apply (`sampleRT`). Documented, not tested beyond the velocity readback.
- The fields getters return the current targets' textures; the texture objects change on a size change, as they did under drei.
- No budget line yet; the 3D hook's spec carries the first.

## Attacks tried

- The two-instances attack from the review skill: two hooks in one app return two textures (unit test).
- A force present during the warm-up frames, then released: the field persists and decays (browser test).
- Sustained force for 24 steps compared cell by cell against the WebGL version with only its clear bug fixed: identical to three decimals (probe, 2026-10-06; not kept as a test, since it needs both implementations).

## The demo, 2026-10-07

The first run of the demo skill; its REPL answers are the spec (`.claude/skills/demo/SKILL.md`). Decisions the build made:

- **Placement by maths, no scissor.** `placeInView` puts a unit plane at `distance` along the camera's view axis, offset along its right and up, scaled to the rectangle's share of the view at that distance; one call per frame per plane, no allocation. The camera's world position and quaternion are read from the Canvas's camera object, which has no parent in fiber's default setup; a parented camera would need the world transform read first. Test: `src/utils/placeInView.test.js`, five cases including a turned camera; and the browser test's first case, which reads one pixel in from and one beyond each edge.
- **The rectangle is measured on the DOM side** by a probe div inset in the stage, with a ResizeObserver for size and scroll and resize listeners for position; the size is state (the fluid's targets follow it through props), the position a ref (the frame loop reads it). The Canvas is assumed to fill the viewport: the one contract on the site, in the doc.
- **The pointer is mapped into the rectangle** by the demo's own force callback: fiber's pointer is Canvas-wide NDC, the fluid's is the rectangle's; the diff is scaled by the ratio of the two. Test: the browser test's stroke case.
- **The material never flows through render.** The compiler lint refuses writes to a value passed to a hook, so the material is built in an effect, held in a ref, assigned to the mesh imperatively, and written by the settings and environment effects reading the ref; disposed on kind change and unmount. The environment is per material (`envMap`), so the site's scene is never touched; loaded only when picked, from the assets package's lazy modules through the EXR loader, or the procedural room through the PMREM generator; the previous one disposed when replaced, and a load that lands after a change is disposed unused (the ignore flag).
- **Lights are scene-wide.** The directional light reaches every lit material in the site's Canvas; stated in the doc as the site's contract. three's lights have no per-object masking beyond layers against the camera.
- **Bump under basic shows the colour map**, since the basic material has no lighting; the select keeps `bump` available so switching to standard shows it without a second change.
- **The sidebar is driven through the DOM in the browser test** (`window.__demo.set`), the native value setter plus the event React listens for, so the test exercises the same path a hand does.

Gaps, declared:

- **No effects yet.** The `EFFECTS` enum is in the demos entry; the chain (three's `RenderPipeline`, the display nodes) waits for the decision on who renders it in a shared Canvas: the demo taking the frame while mounted, as drei's composer does, or the site owning one chain.
- **A parented camera** is not handled; see placement above.
- **Numbers** in the browser test were measured on 2026-10-07 under SwiftShader; a GPU may land elsewhere within the margins.
