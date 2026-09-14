# export:logo-group

`assets/logo/export-group.js`. Renders the `CocoonLogoGroup` mesh with three's own `WebGLRenderer` and prints every prop value beside it, so a change to the mesh is judged by looking at what the component would mount rather than by reading numbers. The geometry is built by the same `buildLogo` the component calls (`src/CocoonLogoGroup/build.js`); the page draws those vertex buffers and nothing else.

```bash
npm run export:logo-group
npm run export:logo-group -- --view icon --depth 0.08 --yaw 50 --pitch 25
npm run export:logo-group -- --scene '{"planes":3}' --extrudeOptions '{"bevelSegments":2}'
npm run export:logo-group -- --meshStandardMaterialProps '{"roughness":0.4}' --reverse
npm run export:logo-group -- --browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npm run export:logo-group -- --help
```

## How it draws

The script writes one self-contained HTML page: three inlined, the pieces' position and normal buffers inlined, the labels set in the repo's Saira. The page renders three cells, each its own `WebGLRenderer` on a canvas, set up the way a fiber `<Canvas>` sets it: antialiased, opaque, ACES filmic tone mapping, sRGB output, the ground as the clear colour. The materials are the component's: `meshBasicMaterial` with `toneMapped` off, or `meshStandardMaterial` with the given props when `--meshStandardMaterialProps` is passed, plus an ambient and a directional light for the lit cells.

The cells, left to right:

1. **head on** — yaw 0, pitch 0, the camera a nav would use. The ink is fitted to the viewport at the camera's distance: whichever of its width and height binds fills `fill` of the view.
2. **turned** — the same distance, turned by `yaw` about y and `pitch` about x, which shows the depth and the plane stacking.
3. **detail** — the front triangle, turned the same way, framed close and lit with `meshStandardMaterial`, since a flat material shows no bevel. The label says so.

Under them, two columns: every component prop as resolved, `(default)` marked where you did not set it, and the measures that follow: height, depth, the derived gap, the tones, vertices per piece, the build time, the camera, and what the renderer is set to.

The PNG is a screenshot of that page taken by a headless Chromium through `puppeteer-core`, so it is the render and nothing else. Chromium's SwiftShader draws WebGL 2 without a GPU. With no Chromium the HTML is still written and opens in any browser; the render is the same.

## Options

Component props, exactly as `docs/CocoonLogoGroup.md` describes them, each `--<prop> <value>`; `--reverse` alone is true; `--scene`, `--extrudeOptions` and `--meshStandardMaterialProps` take JSON.

| option                        | default         |                                                       |
| ----------------------------- | --------------- | ----------------------------------------------------- |
| `--view`                      | `lockup`        | `lockup` or `icon`                                    |
| `--width`                     | 1               | ink width, world units                                |
| `--depth`                     | ink height / 4  | z extent, world units                                 |
| `--maxSize`                   | 1000            | widest expected draw, px                              |
| `--eps`                       | 0.25            | chord error at `maxSize`, px                          |
| `--scene`                     | the house scene | JSON, `{ planes, depth, radius, angle, perspective }` |
| `--cut`, `--haze`             | `vapour`        | the haze total by name or by number                   |
| `--reverse`                   | off             | light on dark; the ground becomes the surface colour  |
| `--surface`                   | `#141414`       | hex                                                   |
| `--ground`                    | `#FFFFFF`       | hex; also the clear colour and the page background    |
| `--size`, `--air`             | 1, 2            | the lockup's icon size and clear air                  |
| `--gap`                       | derived         | the front-edge gap in stems                           |
| `--extrudeOptions`            | none            | JSON, merged over the extrusion defaults              |
| `--meshStandardMaterialProps` | none            | JSON; an object lights every cell with that material  |

The camera, the sheet and the browser.

| option       | default                            |                                                                                     |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `--fov`      | 20                                 | vertical field of view, degrees                                                     |
| `--distance` | fits `--fill`                      | camera distance, world units                                                        |
| `--fill`     | 0.9                                | the fraction of the head-on view the ink fills, width or height, whichever binds    |
| `--yaw`      | 35                                 | the turned cells' rotation about y, degrees                                         |
| `--pitch`    | 20                                 | the turned cells' rotation about x, degrees                                         |
| `--light`    | `-0.4,0.6,1`                       | where the directional light comes from, x,y,z; lit cells only                       |
| `--ambient`  | 0.6                                | ambient light intensity; lit cells only                                             |
| `--cell`     | 900                                | cell width, px; cells are 2:1                                                       |
| `--browser`  | `COCOON_BROWSER`, then usual paths | the Chromium or Chrome executable for the screenshot; none found, no PNG is written |
| `--out`      | `assets/logo/explorations/export/` | where the files go; gitignored                                                      |
| `--name`     | `cocoon-logo-group`                | file stem                                                                           |

The usual paths are `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`, and the Chrome and Chromium apps on macOS. The sandbox image installs Debian's `chromium` for this.

## Output

`<name>.html` and, with a browser, `<name>.png` in `--out`. The terminal gets the vertex count, the build time, the camera, and the paths.

## The camera for the nav

The mesh is the flat logo with a little depth behind it, so a perspective camera shows the flat logo to the degree that its depth is small next to the camera distance. Head on, the back plane at −depth appears `distance / (distance + depth)` the size of the front and slides toward the vanishing point by the same fraction of its offset. At the defaults, fov 20° and the ink filling 90% of a 2:1 view, the distance is about 1.58 widths and the back plane reads 98.1% of the front: on a 200 px nav logo the fourth triangle is under half a pixel smaller than the SVG's and its trail step under a pixel shorter, which is below what the eye holds against the flat logo.

A narrower field of view moves the camera out for the same framing and flattens it further: fov 10° puts the camera at about 3.2 widths and the back plane at 99.1%. Anything from 10° to 25° reads as the logo; wider than 30° starts to show the stack as a stack. A true match needs an orthographic camera, where every plane projects at its own size whatever the distance; the mesh works under one unchanged.

The script prints the distance for whatever fov and fill you give it, so a nav that knows its px width can take `fill` from that width over the viewport's and read the distance off.

## Module API

```js
import {
  parseArgs,
  plan,
  html,
  run,
  screenshot,
  findBrowser,
  fitDistance,
  orbit,
  OPTIONS,
  COMPONENT_PROPS,
} from 'assets/logo/export-group.js'

const o = parseArgs(['--view', 'icon', '--yaw', '50']) // argv after the script name
plan(o) // { data, logo, buildMs, camera, back, vertices }: everything the page needs, as data
html(plan(o).data) // the page text
await run(o) // writes the files; { paths: { html, png }, browser, ...plan(o) }
await screenshot(htmlPath, browserPath) // the PNG buffer of the page's #sheet
findBrowser(given) // the executable to use, or null
fitDistance(width, height, fov, aspect, fill) // the distance at which the face fills fill of the view
orbit({ distance, yaw, pitch, target }) // a camera position on a sphere about target
```

## Limits

- The page inlines three and the font, so it runs to about 2 MB. It is generated, not committed; the PNG is the file to look at, and it is not committed either.
- The lit cells use one ambient and one directional light. They judge shape and bevel, not the site's lighting.
- Chromium's SwiftShader is a software rasteriser: exact, and slow enough that a sheet takes a few seconds.
