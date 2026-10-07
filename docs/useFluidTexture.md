# useFluidTexture

Outputs a fluid simulation to a `THREE.Texture` and returns it. Can be used as a `THREE.Material` `.map`, `.alphaMap`, or anywhere a texture would normally be used.

Adapted from [fluid-three](https://github.com/mnmxmx/fluid-three). Since 2026-10-06 the passes are TSL node materials on three's WebGPU renderer, which runs on WebGPU where the browser has it and on its WebGL 2 backend elsewhere.

```jsx
import { Canvas } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import { useFluidTexture } from 'cocoon-ai'

const FiberComponent = () => {
  const { texture } = useFluidTexture({ ...options })
  return (
    <mesh>
      <planeGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

// The Canvas must use the WebGPU renderer; the hook throws at mount otherwise.
const App = () => (
  <Canvas
    gl={async (props) => {
      const renderer = new WebGPURenderer({
        ...props,
        forceWebGL: !('gpu' in navigator),
      })
      await renderer.init()
      return renderer
    }}
  >
    <FiberComponent />
  </Canvas>
)
```

`forceWebGL` is optional: without it the renderer picks WebGPU when the page has it and WebGL 2 otherwise. Legacy materials (`meshBasicMaterial` and the rest) render on the WebGPU renderer unchanged.

## Options

Every simulation default is one value in `cocoon.config.js` under `fluid`; the table shows the values as of this writing, the file is the source.

| option              | type                          | default                                     |                                                                                                             |
| ------------------- | ----------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `poissonIterations` | integer                       | 32                                          | simulation param                                                                                            |
| `viscousIterations` | integer                       | 32                                          | simulation param                                                                                            |
| `forceValue`        | number                        | 1                                           | simulation param                                                                                            |
| `resolution`        | number                        | 0.5                                         | relative to fbo size                                                                                        |
| `runEvery`          | integer > 0                   | 1                                           | optionally skip frames                                                                                      |
| `forceSize`         | integer                       | 100                                         | simulation param                                                                                            |
| `viscous`           | integer                       | 30                                          | simulation param                                                                                            |
| `isBounce`          | boolean                       | true                                        | simulation param                                                                                            |
| `dt`                | number                        | 0.014                                       | simulation param                                                                                            |
| `isViscous`         | boolean                       | true                                        | simulation param                                                                                            |
| `BFECC`             | boolean                       | true                                        | simulation param                                                                                            |
| `forceCallbackRef`  | React ref to a force callback | see note below                              | override force - defaults to pointer diff                                                                   |
| `forceMesh`         | `THREE.Mesh`                  |                                             | overrides the force callback; a mesh whose projection onto the 2D plane defines the force size and position |
| `customCamera`      | `THREE.PerspectiveCamera`     |                                             | custom camera for the shader passes                                                                         |
| `fboWidth`          | integer                       |                                             | defaults to viewport width                                                                                  |
| `fboHeight`         | integer                       |                                             | defaults to viewport height                                                                                 |
| `fboOpts`           | RenderTarget options          | `{ type: HalfFloatType, format: RGFormat }` | referentially stable, or the targets rebuild each render                                                    |
| `outputFboOpts`     | Object                        | `{ type: HalfFloatType }`                   |                                                                                                             |
| `manual`            | boolean                       | false                                       | manually render a frame with returned `render` callback                                                     |
| `priority`          | integer                       | -1                                          | `r3f` render priority                                                                                       |
| `pause`             | boolean                       | false                                       | does not apply in manual mode                                                                               |
| `pauseRef`          | React ref                     |                                             | same as `pause`, but allows for imperative control                                                          |
| `manualRef`         | React ref                     |                                             | same as `manual`, but allows for imperative control                                                         |

`forceCallbackRef` default:

```jsx
const defaultForceCallback = (delta, clock, pointer, pointerDiff) => ({
  force: pointerDiff,
  center: pointer,
})
```

## Returns

`{ texture, render, fields }`

`texture` is the output FBO's texture, the picture: white where the fluid is still, darker where it moves. `render(state, delta)` is a callback to imperatively, manually run frames. `fields` holds the simulation's own textures for consumers that want more than the picture, each a getter read when used, since pressure alternates between two targets: `fields.velocity`, the projected velocity of the last step, RG in the FBO's type, for displacement or refraction; `fields.pressure`, the last Jacobi iteration's pressure; `fields.divergence`, the divergence the pressure was solved from. All three include the wall cells on the rim.

## Notes

`defaultForceCallback` is invoked as follows, with `fc` defaulting as noted above.

```jsx
const {
  force,
  center,
  radius = forceSize,
} = fc(
  delta,
  clock && clock.getElapsedTime(),
  pointer && pointer.clone(),
  pointer && pointerDiff.current.clone(),
)
```

There are 5 frames computed on mount regardless of props in order to compile every program and allocate every target up front, so the stutter lands during the loading screen rather than on the first pointer move.

The force accumulates. The WebGL version of this hook rendered its force pass with the renderer's autoClear on, so the renderer cleared the target advection had just written and the fluid kept no memory between frames; what looked like memory came from the pressure solve's warm start. Measured on 2026-10-06: an opaque 0.5 then an additive 0.25 into one target read back 0.25 with autoClear on, 0.75 with it off. The pointer force is now part of the advection pass: its fragment adds the radial bump at `center` to the advected velocity, so there is no blended force pass and nothing depends on the renderer's clear state. A mesh force is drawn into a target of its own, allocated only while `forceMesh` is given and cleared by the renderer's manual clear before the draw, which ignores autoClear; advection samples it. No pass reads or writes a renderer option, so the hook behaves the same under any consumer that manages the renderer, drei's View included. The flow persists after a force stops and decays, and the browser test measures it. Forces that looked right before are now about ten times too strong. One difference from the old force quad, which was clamped at the top-right edge of the canvas and squashed the bump there: the folded bump is simply cut off by the edge.

The passes sample their inputs at computed coordinates. A texture node flips y for a render-target texture only when sampled at its default uv, so `tsl/common.js` flips the coordinate at every explicit sample and the maths stays y-up as the GLSL wrote it. The output pass alone samples unflipped, so that the returned `texture` is upright through a material's `map`: a force at positive y darkens the top of the picture, verified against a screenshot of the canvas on both backends (2026-10-06). The browser tests run every scenario on both backends, WebGPU through Vulkan on SwiftShader and WebGL 2 through ANGLE, and the two agree to the grey level. Two readback facts for anyone testing against this renderer: `readRenderTargetPixelsAsync` returns rows bottom first on the WebGL backend and top first on the WebGPU backend, and the WebGPU backend pads every row but the last to 256 bytes; `useFluidTexture.browser-entry.jsx` handles both.

`isBounce` draws the wall: four line segments on the rim, each cell taking a scale times its neighbour one cell inward, drawn after the quad of every pass that writes velocity or pressure. The scale is −1 on velocity, after advection, diffusion and projection, so the velocity at the wall face is zero; and 1 on pressure, after every Jacobi iteration, so the pressure gradient across the wall is zero. The picture is the interior: the output pass samples the cells inside the rim, so the wall is never shown. WebGL cannot sample the texture a pass writes, so the wall reads its neighbour from the pass's input, one step stale; for pressure that is a Jacobi iteration exactly, and for velocity the wall is redrawn after every step. The wall test in `useFluidTexture.browser.test.js` measures it.

`fields` are the fields' current textures; after a size change they are new texture objects, read the getters when used.

The scheme is Stam's stable fluids as Harris describes it for the GPU: Harris, M. J., "Fast Fluid Dynamics Simulation on the GPU", _GPU Gems_ chapter 38, NVIDIA, 2004, free to read at <https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu>. Section 38.3 states the boundary conditions above, and Listing 38-5 is the one fragment program for both, which `boundary.js` is, as a node material on line segments. The passes themselves are in `tsl/passes.js`, one TSL function per GLSL file the WebGL version had.
