# useFluidTexture

Outputs a fluid simulation to a `THREE.Texture` and returns it. Can be used as a `THREE.Material` `.map`, `.alphaMap`, or anywhere a texture would normally be used.

Adapted from [fluid-three](https://github.com/mnmxmx/fluid-three).

```jsx
import { useFluidTexture } from 'cocoon-ai'

const FiberComponent = () => {
  const texture = useFluidTexture({ ...options })
  return (
    <mesh>
      <planeGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
```

## Options

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
| `fboOpts`           | Object                        | `{ type: HalfFloatType, format: RGFormat }` |                                                                                                             |
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

`isBounce` draws the wall: four line segments on the rim, each cell taking a scale times its neighbour one cell inward, drawn after the quad of every pass that writes velocity or pressure. The scale is −1 on velocity, after advection, diffusion and projection, so the velocity at the wall face is zero; and 1 on pressure, after every Jacobi iteration, so the pressure gradient across the wall is zero. The picture is the interior: the output pass samples the cells inside the rim, so the wall is never shown. WebGL cannot sample the texture a pass writes, so the wall reads its neighbour from the pass's input, one step stale; for pressure that is a Jacobi iteration exactly, and for velocity the wall is redrawn after every step. The wall test in `useFluidTexture.browser.test.js` measures it.

The scheme is Stam's stable fluids as Harris describes it for the GPU: Harris, M. J., "Fast Fluid Dynamics Simulation on the GPU", _GPU Gems_ chapter 38, NVIDIA, 2004, free to read at <https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu>. Section 38.3 states the boundary conditions above, and Listing 38-5 is the one fragment program for both, which `boundary.js` is.
