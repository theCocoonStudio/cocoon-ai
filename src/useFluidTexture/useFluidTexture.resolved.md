# useFluidTexture — resolved

Written with the port to TSL, 2026-10-06, against the retroactive spec beside it.

## Decisions

- **Renderer.** The hook requires the WebGPU renderer (`three/webgpu`), on either of its backends. The legacy renderer cannot build node materials, so the hook throws at mount with the Canvas setup named (exits.throws). Tested in the unit tests with fiber's `gl` option marking the test renderer's mock.
- **The force accumulates.** The WebGL version rendered the force pass with autoClear on, so the renderer cleared the target advection had just written and the fluid had no memory between frames; what looked like memory was the pressure solve's warm start. Found on 2026-10-06 while porting, measured on the legacy renderer: an opaque 0.5 then an additive 0.25 read back 0.25 with autoClear on and 0.75 with it off. The two force passes now run with autoClear off (frame.3) and the browser test "the flow persists after the force stops" holds it. The toggle is local and synchronous, so fiber's state and portal-style consumers of the renderer never observe it; `setRendererOptionsInternally: false` opts out, for an app that manages the renderer's options itself (Izzy's review, 2026-10-07).
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
