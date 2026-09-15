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

`{ texture, render}`

`texture` is the output FBO's texture. `render(state, delta)` is a callback to imperatively, manually run frames.

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
