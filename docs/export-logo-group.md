# export:logo-group

`assets/logo/export-group.js`. Draws the `CocoonLogoGroup` mesh through a perspective camera, in Node, without a GPU, and prints every prop value on the sheet, so a change to the mesh is judged by looking at what the component would mount rather than by reading numbers. The geometry is built by the same `buildLogo` the component calls (`src/CocoonLogoGroup/build.js`); nothing is redrawn by hand.

```bash
npm run export:logo-group
npm run export:logo-group -- --view icon --depth 0.08 --yaw 50 --pitch 25
npm run export:logo-group -- --scene '{"planes":3}' --extrudeOptions '{"bevelSegments":2}'
npm run export:logo-group -- --reverse --fov 12 --cell 600
npm run export:logo-group -- --help
```

## How it draws

Every triangle of every piece is taken to world space through the piece's position and uniform scale, culled when it faces away from the camera, projected with a three `PerspectiveCamera`, shaded by one directional light in linear light (`ambient` plus the rest by the face's angle to the light), sorted back to front and written as an SVG polygon. resvg rasterises the sheet. Labels are set in the repo's Saira, since the container has no system fonts.

Three cells, left to right:

1. **head on** — yaw 0, pitch 0, the camera a nav would use. The ink fills `fill` of the cell's width.
2. **turned** — the same distance, turned by `yaw` about y and `pitch` about x, which shows the depth and the plane stacking.
3. **detail** — the front triangle, turned the same way and framed three of its widths wide, which shows the bevel.

Under them, two columns: every component prop as resolved, `(default)` marked where you did not set it, and the measures that follow: height, depth, the derived gap, the tones, vertices per piece, triangles drawn, the build time, and the camera.

## Options

Component props, exactly as `docs/CocoonLogoGroup.md` describes them, each `--<prop> <value>`; `--reverse` alone is true; `--scene` and `--extrudeOptions` take JSON.

| option             | default         |                                                       |
| ------------------ | --------------- | ----------------------------------------------------- |
| `--view`           | `lockup`        | `lockup` or `icon`                                    |
| `--width`          | 1               | ink width, world units                                |
| `--depth`          | ink height / 4  | z extent, world units                                 |
| `--maxSize`        | 1000            | widest expected draw, px                              |
| `--eps`            | 0.25            | chord error at `maxSize`, px                          |
| `--scene`          | the house scene | JSON, `{ planes, depth, radius, angle, perspective }` |
| `--cut`, `--haze`  | `vapour`        | the haze total by name or by number                   |
| `--reverse`        | off             | light on dark; the sheet stands on the surface colour |
| `--surface`        | `#141414`       | hex                                                   |
| `--ground`         | `#FFFFFF`       | hex; also the sheet's background                      |
| `--size`, `--air`  | 1, 2            | the lockup's icon size and clear air                  |
| `--gap`            | derived         | the front-edge gap in stems                           |
| `--extrudeOptions` | none            | JSON, merged over the extrusion defaults              |

The camera and the sheet.

| option       | default                            |                                                                                   |
| ------------ | ---------------------------------- | --------------------------------------------------------------------------------- |
| `--fov`      | 20                                 | vertical field of view, degrees                                                   |
| `--distance` | fits `--fill`                      | camera distance, world units                                                      |
| `--fill`     | 0.8                                | the fraction of the head-on cell's width the ink fills when `--distance` is unset |
| `--yaw`      | 35                                 | the turned cells' rotation about y, degrees                                       |
| `--pitch`    | 20                                 | the turned cells' rotation about x, degrees                                       |
| `--light`    | `-0.4,0.6,1`                       | the direction the light comes from, x,y,z                                         |
| `--ambient`  | 0.55                               | light that reaches every face, 0 to 1                                             |
| `--cell`     | 900                                | cell width, px; cells are 2:1                                                     |
| `--out`      | `assets/logo/explorations/export/` | where the files go; gitignored                                                    |
| `--name`     | `cocoon-logo-group`                | file stem                                                                         |

## Output

`<name>.svg` and `<name>.png` in `--out`. The terminal gets the vertex count, the build time, the camera and the two paths.

## The camera for the nav

The mesh is the flat logo with a little depth behind it, so a perspective camera shows the flat logo to the degree that its depth is small next to the camera distance. Head on, the back plane at −depth appears `distance / (distance + depth)` the size of the front and slides toward the vanishing point by the same fraction of its offset. At the defaults, fov 20° and the ink filling 80% of a 2:1 view, the distance is about 1.77 widths and the back plane reads 98.3% of the front: on a 200 px nav logo the fourth triangle is a third of a pixel smaller than the SVG's and its trail step under a pixel shorter, which is below what the eye holds against the flat logo.

A narrower field of view moves the camera out for the same framing and flattens it further: fov 10° puts the camera at 3.5 widths and the back plane at 99.1%. Anything from 10° to 25° reads as the logo; wider than 30° starts to show the stack as a stack. A true match needs an orthographic camera, where every plane projects at its own size whatever the distance; the mesh works under one unchanged.

The script prints the distance for whatever fov and fill you give it, so a nav that knows its px width can take `fill` from that width over the viewport's and read the distance off.

## Module API

```js
import {
  parseArgs,
  sheet,
  run,
  project,
  camera,
  fitDistance,
  shade,
  OPTIONS,
  COMPONENT_PROPS,
} from 'assets/logo/export-group.js'

const o = parseArgs(['--view', 'icon', '--yaw', '50']) // argv after the script name
sheet(o) // { svg, width, height, values, camera, back, buildMs, vertices }
run(o) // writes the two files; { paths, ...sheet(o) }
camera({ fov, distance, yaw, pitch, target }, aspect) // a PerspectiveCamera on a sphere about target
fitDistance(width, fov, aspect, fill) // the distance at which width fills fill of the view
project(logo, camera, W, H, { light, ambient }) // { polygons, count } for a buildLogo() result
```

## Limits

- Painter's order: triangles are sorted by their centre's distance, which is exact for this mesh head on and near enough turned; a wild `--extrudeOptions` that folds a piece through another can draw out of order.
- One light, no shadows, no ambient occlusion. The sheet judges shape and bevel, not the site's lighting.
- The SVG keeps every drawn triangle, about 3,500 polygons at the defaults; the PNG is the file to look at.
