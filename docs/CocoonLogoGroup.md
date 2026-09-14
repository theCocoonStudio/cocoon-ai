# CocoonLogoGroup

`src/CocoonLogoGroup/index.jsx`. The cocoon logo as a group of extruded meshes for a react-three-fiber scene: the four triangles of the mark, front first, and in the lockup view the wordmark beside them. The recession is the same scene the SVG logo and the icon set are cut from (`src/utils/hazePlanes.js`); the outlines are the shipped artwork's, carried in `logo.js`, which `npm run assets:logo` regenerates. Nothing runs per frame: move the group. Built from `CocoonLogoGroup.spec.md`; `CocoonLogoGroup.resolved.md` records what the build settled.

```jsx
import { Canvas } from '@react-three/fiber'
import { CocoonLogoGroup } from 'cocoon-ai'

;<Canvas>
  <CocoonLogoGroup position={[-1.2, 0.8, 0]} />
  <CocoonLogoGroup view='icon' width={0.4} reverse />
  <CocoonLogoGroup
    meshStandardMaterialProps={{ roughness: 0.4 }}
    geometryProps={{ dispose: null }}
  />
</Canvas>
```

## Props

The artwork.

| prop      | default        |                                                                               |
| --------- | -------------- | ----------------------------------------------------------------------------- |
| `view`    | `'lockup'`     | `'lockup'`, the icon left of the wordmark; `'icon'`, the mark alone           |
| `width`   | 1              | the ink's width, world units; the height follows the artwork                  |
| `depth`   | ink height / 4 | the group's z extent, front faces to back faces, bevels included; world units |
| `maxSize` | 1000           | the widest the logo is expected to be drawn, px                               |
| `eps`     | 0.25           | the chord error allowed at `maxSize` when the outlines are simplified, px     |

The scene, in the util's terms. Defaults are the shipped mark's.

| prop                | default              |                                                                                                                            |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `scene`             | the house scene      | `{ planes, depth, radius, angle, perspective }`; a missing key takes `HAZE_DEFAULTS`. Its `depth` is the last plane's size |
| `cut`, `haze`       | `'vapour'`           | `'vapour'` or `'dense'`, or a raw transmittance total                                                                      |
| `reverse`           | `false`              | swaps surface and ground in the ramp                                                                                       |
| `surface`, `ground` | `#141414`, `#FFFFFF` | the near and far ends of the ramp; hex. Nothing is painted with `ground`                                                   |

The lockup.

| prop   | default |                                                                                                                                                    |
| ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size` | 1       | the icon's height as a multiple of the wordmark's x-height band                                                                                    |
| `air`  | 2       | the clear air, in wordmark stems, the derived gap must deliver: air plus the worst trail over the shipped sizes and `size`, up to the quarter stem |
| `gap`  | derived | the front-edge gap in stems, replacing the derivation                                                                                              |

The meshes.

| prop                        | default |                                                                                                      |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `extrudeOptions`            | `{}`    | merged over the extrusion defaults for every geometry; see Vertices                                  |
| `meshStandardMaterialProps` | `false` | an object swaps every material for a `meshStandardMaterial` carrying those props                     |
| `meshProps`                 | `{}`    | spread last onto every mesh                                                                          |
| `materialProps`             | `{}`    | spread last onto every material, whichever kind                                                      |
| `geometryProps`             | `{}`    | spread last onto every geometry; `dispose={null}` leaves disposal to you                             |
| `ref`, the rest             |         | `ref` is the handle; everything else, `position`, `rotation`, `onClick` and so on, goes to the group |

## What you get

A `<group>` holding one mesh per plane, named `plane0` to `plane3`, front first, and in the lockup view a mesh named `wordmark` after them. Every geometry is normalised on its own, larger xy extent 1 and centred on all three axes, and its mesh is scaled uniformly by the piece's world width, so a bevel stays round. The ink is `width` wide with its bounding box centred on the origin, y up, facing +z. Front faces sit at z = 0. Plane k spans z from −k·depth/planes to −(k + 1)·depth/planes; the wordmark spans −depth to 0, so its back meets the last triangle's back.

## Colour

Plane k takes tone k of the `hazeTones` ramp from `surface` toward `ground`; the wordmark takes tone 0, the same material as the front plane at the same depth. The material is a `meshBasicMaterial` with `toneMapped` off, so the tones match the SVG under the Canvas's default ACES tone mapping. `meshStandardMaterialProps` swaps in a lit `meshStandardMaterial` with three's default `toneMapped` left on, by decision (Izzy, 2026-09-13): a lit surface is already a departure from the flat logo, and tone mapping is what the rest of a lit scene expects; the tone still sets `color`. To match the SVG under lights anyway, pass `materialProps={{ toneMapped: false }}`.

## Vertices

The outlines are simplified by Ramer–Douglas–Peucker to `eps` px at `maxSize` px of ink width before they are shaped, so the mesh carries the fewest vertices that hold at the largest size it will be drawn. The extrusion is dice-like: a small bevel, 3 segments, radius 0.3 of one triangle's depth on every piece, inset by a negative `bevelOffset` so the silhouette stays the artwork's; a piece's total z extent, bevel included, is its depth. The default lockup comes to about 21,000 vertices. `extrudeOptions={{ bevelEnabled: false }}` gives a flat cut.

## Handle

| member     |                                                                            |
| ---------- | -------------------------------------------------------------------------- |
| `group`    | the root `Group`                                                           |
| `planes`   | front first, one `{ mesh, geometry, material }` per plane                  |
| `wordmark` | `{ mesh, geometry, material }` in the lockup view; `null` in the icon view |

All of it is `null` before mount. Read it inside `useFrame` or an effect, never during render.

## Disposal

The geometries are the component's: disposed on unmount and when a rebuild replaces them. `geometryProps={{ dispose: null }}` hands both moments to you. The materials are declared in JSX, so fiber disposes them. A rebuild happens only when a value changes; a fresh `scene` or `extrudeOptions` object with the same numbers does not rebuild.

## Bad inputs

Throw from render, naming the prop: a `view` other than the two; a colour `hazeResolve` refuses; `width`, `depth`, `maxSize` or `size` not above 0; `eps`, `air` or `gap` negative; `scene.planes` not a whole number of at least 1; an unknown `cut`. Owner: the nearest error boundary above the Canvas.

## Canvas

Nothing beyond a default `<Canvas>`. The component uses built-in materials and no shaders, so fiber's defaults are the setup it was checked against: `antialias`, ACES filmic tone mapping, sRGB output, opaque or transparent as you choose. With the basic material no light is needed and none is read; `toneMapped` is off on it so the tones come through the tone mapping unchanged. With `meshStandardMaterialProps` the meshes are lit like any other, so give the scene a light or they render black. A `frameloop` of `demand` is fine: nothing here animates, and the owner that moves the group invalidates. Colour management stays at three's default; the hex tones are sRGB and `color` converts them.

For the camera that shows the flat logo, and a page that renders the component's exact geometry with these settings, see `docs/export-logo-group.md`.
