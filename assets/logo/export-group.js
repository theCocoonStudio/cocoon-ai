#!/usr/bin/env node
/**
 * export:logo-group — draw the CocoonLogoGroup mesh through a perspective
 * camera, in Node, with every prop value printed on the sheet.
 *
 *   npm run export:logo-group
 *   npm run export:logo-group -- --view icon --depth 0.08 --yaw 50
 *   npm run export:logo-group -- --scene '{"planes":3}' --extrudeOptions '{"bevelSegments":2}'
 *
 * No GL: the geometry the component would mount is built by the same
 * buildLogo, every triangle is projected with a three PerspectiveCamera,
 * shaded by one directional light, sorted back to front and written as SVG
 * polygons, then rasterised with resvg. Three cells: the head-on view a nav
 * would show, a turned view that shows the depth, and the front triangle
 * turned and close, which shows the bevel. The
 * text block under them lists every prop as resolved, the measures that
 * follow from them, and the camera.
 *
 * `--<prop> <value>` for every component prop; `--scene` and
 * `--extrudeOptions` take JSON. The camera: `--fov` degrees, `--distance`
 * world units (default: the ink fills `--fill` of the head-on view), `--yaw`
 * and `--pitch` degrees for the turned cell, `--light x,y,z` the direction
 * the light comes from. `--cell` is the cell width in px.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { PerspectiveCamera, Vector3 } from 'three'
import { png } from '../lib/raster.js'
import { fmt } from '../lib/fmt.js'
import { buildLogo } from '../../src/CocoonLogoGroup/build.js'
import { FONT } from './lockup.js'

const here = dirname(fileURLToPath(import.meta.url))
export const OUT_DIR = join(here, 'explorations', 'export')

/** Every option: how its value parses, and what it is. Component props first. */
export const OPTIONS = {
  view: { type: 'string', doc: "'lockup' or 'icon'" },
  width: { type: 'number', doc: 'ink width, world units' },
  depth: {
    type: 'number',
    doc: 'z extent, world units; default ink height / 4',
  },
  maxSize: { type: 'number', doc: 'widest expected draw, px' },
  eps: { type: 'number', doc: 'chord error at maxSize, px' },
  scene: { type: 'json', doc: '{ planes, depth, radius, angle, perspective }' },
  cut: { type: 'string', doc: "'vapour' or 'dense'" },
  haze: { type: 'number', doc: 'transmittance total, overrides cut' },
  reverse: { type: 'boolean', doc: 'light on dark' },
  surface: { type: 'string', doc: 'hex, the near end of the ramp' },
  ground: {
    type: 'string',
    doc: 'hex, the far end of the ramp; also the sheet background',
  },
  size: { type: 'number', doc: 'lockup: icon height in x-height bands' },
  air: { type: 'number', doc: 'lockup: clear air in stems' },
  gap: {
    type: 'number',
    doc: 'lockup: front-edge gap in stems, replaces the derivation',
  },
  extrudeOptions: { type: 'json', doc: 'merged over the extrusion defaults' },
  // the camera and the sheet
  fov: { type: 'number', doc: 'vertical field of view, degrees', value: 20 },
  distance: {
    type: 'number',
    doc: 'camera distance, world units; default fits the ink to fill',
  },
  fill: {
    type: 'number',
    doc: 'fraction of the head-on view the ink width fills',
    value: 0.8,
  },
  yaw: {
    type: 'number',
    doc: 'turned cell: rotation about y, degrees',
    value: 35,
  },
  pitch: {
    type: 'number',
    doc: 'turned cell: rotation about x, degrees',
    value: 20,
  },
  light: {
    type: 'vector',
    doc: 'direction the light comes from, x,y,z',
    value: [-0.4, 0.6, 1],
  },
  ambient: {
    type: 'number',
    doc: 'light that reaches every face, 0 to 1',
    value: 0.55,
  },
  cell: { type: 'number', doc: 'cell width, px', value: 900 },
  out: { type: 'string', doc: 'output folder', value: OUT_DIR },
  name: { type: 'string', doc: 'file stem', value: 'cocoon-logo-group' },
}
export const COMPONENT_PROPS = Object.keys(OPTIONS).slice(0, 15)

/** Parse argv after the script name into { props, camera, out, name }. */
export function parseArgs(argv) {
  const o = {}
  for (const [k, v] of Object.entries(OPTIONS)) if ('value' in v) o[k] = v.value
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i]
    if (a === '-h' || a === '--help') return { help: true }
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`)
    let [key, inline] = a.slice(2).split(/=(.*)/s)
    const spec = OPTIONS[key]
    if (!spec) throw new Error(`unknown option --${key}`)
    let raw
    if (spec.type === 'boolean') raw = inline ?? 'true'
    else {
      raw = inline ?? argv[++i]
      if (raw === undefined) throw new Error(`--${key} needs a value`)
    }
    if (spec.type === 'number') {
      o[key] = Number(raw)
      if (!Number.isFinite(o[key]))
        throw new Error(`--${key}: ${raw} is not a number`)
    } else if (spec.type === 'boolean') o[key] = raw !== 'false'
    else if (spec.type === 'json') {
      try {
        o[key] = JSON.parse(raw)
      } catch {
        throw new Error(`--${key}: ${raw} is not JSON`)
      }
    } else if (spec.type === 'vector') {
      o[key] = raw.split(',').map(Number)
      if (o[key].length !== 3 || o[key].some((v) => !Number.isFinite(v)))
        throw new Error(`--${key}: ${raw} is not x,y,z`)
    } else o[key] = raw
  }
  const props = {}
  for (const k of COMPONENT_PROPS) if (k in o) props[k] = o[k]
  return { props, ...o }
}

export function help() {
  const rows = Object.entries(OPTIONS).map(
    ([k, v]) =>
      `  --${k.padEnd(16)} ${v.doc}${'value' in v ? ` (default ${JSON.stringify(v.value)})` : ''}`,
  )
  return `export:logo-group — the logo mesh through a perspective camera\n\n${rows.join('\n')}\n`
}

// ---- colour ----------------------------------------------------------------
const hexToRgb = (h) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const srgbToLin = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const linToSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
/** A tone under a light level, mixed in linear light. */
export function shade(hex, level) {
  return (
    '#' +
    hexToRgb(hex)
      .map((c) =>
        Math.round(
          255 * Math.max(0, Math.min(1, linToSrgb(srgbToLin(c) * level))),
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  )
}

// ---- camera ----------------------------------------------------------------
const rad = (deg) => (deg * Math.PI) / 180

/** The distance at which `width` fills `fill` of a view of this fov and aspect, head on. */
export function fitDistance(width, fov, aspect, fill) {
  return width / fill / 2 / (Math.tan(rad(fov) / 2) * aspect)
}

/** A camera on a sphere of `distance` about `target`, turned by yaw about y and pitch about x. */
export function camera(
  { fov, distance, yaw, pitch, target = [0, 0, 0] },
  aspect,
) {
  const cam = new PerspectiveCamera(fov, aspect, distance / 100, distance * 100)
  cam.position.set(
    target[0] + distance * Math.sin(rad(yaw)) * Math.cos(rad(pitch)),
    target[1] + distance * Math.sin(rad(pitch)),
    target[2] + distance * Math.cos(rad(yaw)) * Math.cos(rad(pitch)),
  )
  cam.lookAt(...target)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

/**
 * Every visible triangle of the built logo as an SVG polygon in a W x H px
 * view, shaded, sorted back to front. Returns { polygons, count }.
 */
export function project(logo, cam, W, H, { light, ambient }) {
  const L = new Vector3(...light).normalize()
  const eye = cam.position
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const n = new Vector3()
  const e1 = new Vector3()
  const e2 = new Vector3()
  const mid = new Vector3()
  const tris = []
  for (const p of logo.pieces) {
    const pos = p.geometry.attributes.position
    const [px, py, pz] = p.position
    const w = p.width
    const at = (v, i) =>
      v.set(pos.getX(i) * w + px, pos.getY(i) * w + py, pos.getZ(i) * w + pz)
    for (let t = 0; t + 2 < pos.count; t += 3) {
      at(a, t)
      at(b, t + 1)
      at(c, t + 2)
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a))
      if (n.lengthSq() === 0) continue
      n.normalize()
      mid
        .addVectors(a, b)
        .add(c)
        .multiplyScalar(1 / 3)
      if (n.dot(e1.subVectors(eye, mid)) <= 0) continue // faces away
      const level = ambient + (1 - ambient) * Math.max(0, n.dot(L))
      const depth = mid.distanceTo(eye)
      const pts = [a, b, c].map((v) => {
        const q = v.clone().project(cam)
        return `${fmt(((q.x + 1) / 2) * W, 2)},${fmt(((1 - q.y) / 2) * H, 2)}`
      })
      tris.push({ depth, fill: shade(p.tone, level), pts: pts.join(' ') })
    }
  }
  tris.sort((u, v) => v.depth - u.depth)
  return {
    // A hairline stroke in the fill hides the seams antialiasing leaves between neighbours.
    polygons: tris
      .map(
        (t) =>
          `<polygon points="${t.pts}" fill="${t.fill}" stroke="${t.fill}" stroke-width="0.7" stroke-linejoin="round"/>`,
      )
      .join(''),
    count: tris.length,
  }
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const r4 = (v) => (typeof v === 'number' ? Number(v.toFixed(4)) : v)

/**
 * The sheet: the head-on cell, the turned cell, and the text block. Returns
 * { svg, width, height, values, camera }.
 */
export function sheet(o) {
  const t0 = performance.now()
  const logo = buildLogo(o.props)
  const buildMs = performance.now() - t0
  const W = o.cell
  const H = Math.round(W / 2)
  const aspect = W / H
  const distance = o.distance ?? fitDistance(logo.width, o.fov, aspect, o.fill)
  const front = logo.pieces[0]
  const cams = [
    { label: 'head on, yaw 0 pitch 0', yaw: 0, pitch: 0, distance },
    {
      label: `turned, yaw ${o.yaw} pitch ${o.pitch}`,
      yaw: o.yaw,
      pitch: o.pitch,
      distance,
    },
    {
      label: `detail: the front triangle, turned, ${r4(front.width * 3)} wide in view`,
      yaw: o.yaw,
      pitch: o.pitch,
      distance: fitDistance(front.width * 3, o.fov, aspect, 1),
      target: front.position,
    },
  ]
  const PAD = 24
  const GUT = 24
  const LINE = 18
  const opts = logo.options
  const ground = opts.reverse ? opts.surface : opts.ground
  const ink = opts.reverse ? opts.ground : opts.surface
  let cells = ''
  let x = PAD
  let triangles = 0
  for (const cm of cams) {
    const cam = camera({ fov: o.fov, ...cm }, aspect)
    const { polygons, count } = project(logo, cam, W, H, o)
    triangles = Math.max(triangles, count)
    cells +=
      `\n  <text x="${x}" y="${PAD + 14}" font-size="13" fill="${ink}">${esc(cm.label)}</text>` +
      `\n  <svg x="${x}" y="${PAD + LINE}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<rect width="${W}" height="${H}" fill="none" stroke="${ink}" stroke-opacity="0.15"/>${polygons}</svg>`
    x += W + GUT
  }
  const vertices = logo.pieces.map((p) => p.geometry.attributes.position.count)
  const propLines = COMPONENT_PROPS.map((k) => {
    const v =
      k === 'scene' || k === 'extrudeOptions'
        ? JSON.stringify(opts[k] ?? null, (_, x) => r4(x))
            .replace(/[{}"]/g, '')
            .replace(/,/g, ', ')
        : r4(opts[k])
    return [k, `${v}${k in o.props ? '' : '   (default)'}`]
  })
  const back = distance / (distance + logo.depth)
  const derived = [
    ['height', r4(logo.height)],
    [
      'depth',
      `${r4(logo.depth)}${o.props.depth == null ? '   (ink height / 4)' : ''}`,
    ],
    ['gap, stems', logo.gap ?? 'n/a (icon)'],
    ['tones', logo.tones.join(' ')],
    [
      'vertices',
      `${vertices.join(' + ')} = ${vertices.reduce((s, v) => s + v, 0)}`,
    ],
    ['triangles drawn', triangles],
    ['build', `${buildMs.toFixed(1)} ms`],
    ['', ''],
    ['fov', `${o.fov} deg`],
    [
      'distance',
      `${r4(distance)}${o.distance == null ? `   (ink fills ${o.fill} of the head-on view)` : ''}`,
    ],
    ['back plane reads', `${(back * 100).toFixed(2)} % of the front, head on`],
    ['light from', `${o.light.join(', ')}   ambient ${o.ambient}`],
    [
      'bevel, world',
      `${r4(front.extrude.bevelSize * front.width)}   segments ${front.extrude.bevelSegments}`,
    ],
  ]
  const textTop = PAD + LINE + H + PAD
  const col = (lines, cx) =>
    lines
      .map(
        ([k, v], i) =>
          `\n  <text x="${cx}" y="${textTop + i * LINE}" font-size="13" fill="${ink}">${esc(k)}</text>` +
          `<text x="${cx + 150}" y="${textTop + i * LINE}" font-size="13" fill="${ink}" xml:space="preserve">${esc(v)}</text>`,
      )
      .join('')
  const width = PAD + cams.length * (W + GUT) - GUT + PAD
  const height =
    textTop + Math.max(propLines.length, derived.length) * LINE + PAD
  const svg =
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="Saira">` +
    `\n  <rect width="${width}" height="${height}" fill="${ground}"/>` +
    cells +
    col(propLines, PAD) +
    col(derived, PAD + W + GUT) +
    `\n</svg>\n`
  return {
    svg,
    width,
    height,
    values: opts,
    camera: { fov: o.fov, distance, yaw: o.yaw, pitch: o.pitch },
    back,
    buildMs,
    vertices,
  }
}

/** Write `<name>.svg` and `<name>.png` into `out`. */
export function run(o) {
  const s = sheet(o)
  mkdirSync(o.out, { recursive: true })
  const paths = {
    svg: join(o.out, `${o.name}.svg`),
    png: join(o.out, `${o.name}.png`),
  }
  writeFileSync(paths.svg, s.svg)
  writeFileSync(
    paths.png,
    png(s.svg, {
      width: s.width,
      background: s.values.reverse ? s.values.surface : s.values.ground,
      fonts: { files: [FONT], family: 'Saira' },
    }),
  )
  return { paths, ...s }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2))
  if (o.help) {
    console.log(help())
    process.exit(0)
  }
  const r = run(o)
  console.log(
    `${r.values.view}: ${r.vertices.reduce((s, v) => s + v, 0)} vertices, built in ${r.buildMs.toFixed(1)} ms`,
  )
  console.log(
    `camera: fov ${r.camera.fov} deg, distance ${r4(r.camera.distance)}; the back plane reads ${(r.back * 100).toFixed(2)} % of the front head on`,
  )
  console.log(r.paths.svg)
  console.log(r.paths.png)
}
