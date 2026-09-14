#!/usr/bin/env node
/**
 * export:logo-group — render the CocoonLogoGroup mesh with three's own
 * WebGLRenderer and print every prop value beside it.
 *
 *   npm run export:logo-group
 *   npm run export:logo-group -- --view icon --depth 0.08 --yaw 50
 *   npm run export:logo-group -- --scene '{"planes":3}' --extrudeOptions '{"bevelSegments":2}'
 *   npm run export:logo-group -- --browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 *
 * The geometry the component would mount is built by the same buildLogo,
 * then written into one self-contained HTML page: three inlined, the vertex
 * buffers inlined, the labels set in the repo's Saira. The page renders three
 * cells with a PerspectiveCamera through WebGLRenderer, the renderer set up
 * as a fiber Canvas sets it, ACES tone mapping and sRGB output, on an opaque
 * ground: the head-on view a nav would show, fitted to the viewport at the
 * camera's distance; the same turned, which shows the depth; and the front
 * triangle turned and close under a light, which shows the bevel.
 *
 * The PNG is a screenshot of that page, taken by a headless Chromium through
 * puppeteer-core, so it is the render and nothing else. No Chromium and the
 * HTML is still written; open it in any browser. `--browser` names the
 * executable; otherwise COCOON_BROWSER, then the usual paths, are tried.
 *
 * `--<prop> <value>` for every component prop; `--scene` and
 * `--extrudeOptions` take JSON. The camera: `--fov` degrees, `--distance`
 * world units (default: the ink fits `--fill` of the head-on view), `--yaw`
 * and `--pitch` degrees for the turned cells, `--light x,y,z` the direction
 * the light comes from. `--cell` is the cell width in px.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { buildLogo } from '../../src/CocoonLogoGroup/build.js'
import { FONT } from './lockup.js'
import { config } from '../../cocoon.config.js'

const here = dirname(fileURLToPath(import.meta.url))
export const OUT_DIR = join(here, 'explorations', 'export')
const THREE_BUILD = join(here, '..', '..', 'node_modules', 'three', 'build')
export const THREE_MODULE = join(THREE_BUILD, 'three.module.min.js')
/** The module above imports this one by a relative path, which a data: URL cannot resolve. */
export const THREE_CORE = join(THREE_BUILD, 'three.core.min.js')
/** Where a Chromium usually is, tried in order after --browser and COCOON_BROWSER. */
export const BROWSERS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

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
    doc: 'hex, the far end of the ramp; also the clear colour',
  },
  size: { type: 'number', doc: 'lockup: icon height in x-height bands' },
  air: { type: 'number', doc: 'lockup: clear air in stems' },
  gap: {
    type: 'number',
    doc: 'lockup: front-edge gap in stems, replaces the derivation',
  },
  extrudeOptions: { type: 'json', doc: 'merged over the extrusion defaults' },
  meshStandardMaterialProps: {
    type: 'json',
    doc: 'an object swaps in the lit material with these props',
  },
  // the camera and the sheet
  fov: {
    type: 'number',
    doc: 'vertical field of view, degrees',
    value: config.logoGroupExport.fov,
  },
  distance: {
    type: 'number',
    doc: 'camera distance, world units; default fits the ink to fill',
  },
  fill: {
    type: 'number',
    doc: 'fraction of the head-on view the ink fills, width or height, whichever binds',
    value: config.logoGroupExport.fill,
  },
  yaw: {
    type: 'number',
    doc: 'turned cells: rotation about y, degrees',
    value: config.logoGroupExport.yaw,
  },
  pitch: {
    type: 'number',
    doc: 'turned cells: rotation about x, degrees',
    value: config.logoGroupExport.pitch,
  },
  light: {
    type: 'vector',
    doc: 'direction the light comes from, x,y,z',
    value: config.logoGroupExport.light,
  },
  ambient: {
    type: 'number',
    doc: 'ambient light intensity for the lit cells',
    value: config.logoGroupExport.ambient,
  },
  cell: {
    type: 'number',
    doc: 'cell width, px; cells are 2:1',
    value: config.logoGroupExport.cell,
  },
  browser: {
    type: 'string',
    doc: 'the Chromium executable for the screenshot',
  },
  out: { type: 'string', doc: 'output folder', value: OUT_DIR },
  name: { type: 'string', doc: 'file stem', value: 'cocoon-logo-group' },
}
export const COMPONENT_PROPS = Object.keys(OPTIONS).slice(0, 16)

/** Parse argv after the script name into { props, ...options }. */
export function parseArgs(argv) {
  const o = {}
  for (const [k, v] of Object.entries(OPTIONS)) if ('value' in v) o[k] = v.value
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') return { help: true }
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`)
    const [key, inline] = a.slice(2).split(/=(.*)/s)
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
      `  --${k.padEnd(26)} ${v.doc}${'value' in v ? ` (default ${JSON.stringify(v.value)})` : ''}`,
  )
  return `export:logo-group — the logo mesh rendered by three, with every prop printed\n\n${rows.join('\n')}\n`
}

// ---- camera ----------------------------------------------------------------
const rad = (deg) => (deg * Math.PI) / 180

/**
 * The distance at which a `width` x `height` face fills `fill` of a view of
 * this vertical fov and aspect, head on: whichever of width and height binds.
 */
export function fitDistance(width, height, fov, aspect, fill) {
  const t = Math.tan(rad(fov) / 2)
  return Math.max(width / (2 * t * aspect), height / (2 * t)) / fill
}

/** Camera position on a sphere of `distance` about `target`, turned by yaw about y and pitch about x. */
export function orbit({ distance, yaw, pitch, target = [0, 0, 0] }) {
  return [
    target[0] + distance * Math.sin(rad(yaw)) * Math.cos(rad(pitch)),
    target[1] + distance * Math.sin(rad(pitch)),
    target[2] + distance * Math.cos(rad(yaw)) * Math.cos(rad(pitch)),
  ]
}

// ---- the page --------------------------------------------------------------
const r4 = (v) => (typeof v === 'number' ? Number(v.toFixed(4)) : v)
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const b64 = (buf) =>
  Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('base64')

/**
 * Everything the page needs, as data: the pieces with their vertex buffers,
 * the cells with their cameras, the labels. Returns { data, logo, buildMs }.
 */
export function plan(o) {
  const t0 = performance.now()
  const logo = buildLogo(o.props)
  const buildMs = performance.now() - t0
  const W = o.cell
  const H = Math.round(W / 2)
  const aspect = W / H
  const distance =
    o.distance ?? fitDistance(logo.width, logo.height, o.fov, aspect, o.fill)
  const front = logo.pieces[0]
  const lit = !!o.props.meshStandardMaterialProps
  const cells = [
    {
      label: 'head on, yaw 0 pitch 0, the ink fitted to the view',
      position: orbit({ distance, yaw: 0, pitch: 0 }),
      target: [0, 0, 0],
      lit,
    },
    {
      label: `turned, yaw ${o.yaw} pitch ${o.pitch}`,
      position: orbit({ distance, yaw: o.yaw, pitch: o.pitch }),
      target: [0, 0, 0],
      lit,
    },
    {
      label: `detail: the front triangle, turned, lit with meshStandardMaterial${lit ? '' : ' at roughness 0.35'} to show the bevel`,
      position: orbit({
        distance: fitDistance(
          front.width * 2.4,
          front.width * 2.4,
          o.fov,
          aspect,
          1,
        ),
        yaw: o.yaw,
        pitch: o.pitch,
        target: front.position,
      }),
      target: front.position,
      lit: true,
    },
  ]
  const pieces = logo.pieces.map((p) => ({
    name: p.name,
    tone: p.tone,
    width: p.width,
    position: p.position,
    position64: b64(p.geometry.attributes.position.array),
    normal64: b64(p.geometry.attributes.normal.array),
  }))
  const vertices = logo.pieces.map((p) => p.geometry.attributes.position.count)
  const opts = logo.options
  const propLines = COMPONENT_PROPS.map((k) => {
    const v =
      k === 'scene' ||
      k === 'extrudeOptions' ||
      k === 'meshStandardMaterialProps'
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
    ['build', `${buildMs.toFixed(1)} ms`],
    ['', ''],
    ['fov', `${o.fov} deg`],
    [
      'distance',
      `${r4(distance)}${o.distance == null ? `   (ink fills ${o.fill} of the head-on view)` : ''}`,
    ],
    ['back plane reads', `${(back * 100).toFixed(2)} % of the front, head on`],
    [
      'light from',
      `${o.light.join(', ')}   ambient ${o.ambient}   (lit cells only)`,
    ],
    [
      'bevel, world',
      `${r4(front.extrude.bevelSize * front.width)}   segments ${front.extrude.bevelSegments}`,
    ],
    [
      'renderer',
      'WebGLRenderer, antialias, ACESFilmic tone mapping, sRGB output, as a fiber Canvas',
    ],
  ]
  const ground = opts.reverse ? opts.surface : opts.ground
  const ink = opts.reverse ? opts.ground : opts.surface
  return {
    data: {
      W,
      H,
      fov: o.fov,
      ground,
      ink,
      light: o.light,
      ambient: o.ambient,
      standard: o.props.meshStandardMaterialProps || null,
      cells,
      pieces,
      propLines,
      derived,
    },
    logo,
    buildMs,
    camera: { fov: o.fov, distance, yaw: o.yaw, pitch: o.pitch },
    back,
    vertices,
  }
}

const dataUrl = (js) =>
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`

/**
 * three as one module the page can import from a data: URL: the build's
 * module with its two references to ./three.core.min.js pointed at the core
 * inlined the same way. Anything else the build imports would fail here,
 * and the test imports the result in Node to prove it loads.
 */
export function threeModule() {
  const core = readFileSync(THREE_CORE, 'utf8')
  const module = readFileSync(THREE_MODULE, 'utf8')
  const refs = module.split('"./three.core.min.js"').length - 1
  if (refs === 0)
    throw new Error(
      `${THREE_MODULE} no longer references ./three.core.min.js; check how three's build is split`,
    )
  return module.replaceAll(
    '"./three.core.min.js"',
    JSON.stringify(dataUrl(core)),
  )
}

/** The self-contained page for a plan. */
export function html(data) {
  const three = threeModule()
  const font = readFileSync(FONT).toString('base64')
  const col = (lines) =>
    lines
      .map(
        ([k, v]) =>
          `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`,
      )
      .join('\n')
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>cocoon logo group</title>
<style>
  @font-face { font-family: Saira; src: url(data:font/ttf;base64,${font}) format('truetype'); font-weight: 100 900; font-stretch: 50% 125%; }
  html, body { margin: 0; background: ${data.ground}; color: ${data.ink}; font: 13px/18px Saira, sans-serif; }
  #sheet { display: inline-block; padding: 24px; }
  .cells { display: flex; gap: 24px; }
  .cell canvas { display: block; width: ${data.W}px; height: ${data.H}px; outline: 1px solid ${data.ink}20; }
  .cell .label { height: 18px; margin-bottom: 6px; }
  .text { display: flex; gap: 24px; margin-top: 24px; }
  .text .col { display: grid; grid-template-columns: 200px auto; column-gap: 12px; width: ${data.W}px; white-space: pre; }
  .setup { max-width: ${2 * data.W + 24}px; margin-top: 18px; }
  .setup code { font-family: ui-monospace, monospace; font-size: 12px; }
</style>
<body>
<div id="sheet">
  <div class="cells">${data.cells.map((c, i) => `\n    <div class="cell"><div class="label">${esc(c.label)}</div><canvas id="c${i}" width="${data.W}" height="${data.H}"></canvas></div>`).join('')}
  </div>
  <div class="text">
    <div class="col">
${col(data.propLines)}
    </div>
    <div class="col">
${col(data.derived)}
    </div>
  </div>
  <div class="setup">
    <p><b>Canvas setup.</b> Each cell is <code>new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true })</code> with <code>toneMapping = ACESFilmicToneMapping</code>, <code>outputColorSpace = SRGBColorSpace</code>, pixel ratio 1 and the ground as the clear colour, which is what a react-three-fiber <code>&lt;Canvas&gt;</code> sets by default. The camera is <code>PerspectiveCamera(fov, 2, 0.01, 100)</code>. The component needs nothing beyond that: built-in materials, no lights for the basic material (its <code>toneMapped</code> is off so the tones survive the tone mapping), one ambient and one directional light where <code>meshStandardMaterial</code> is used. The geometry is the exact buffers <code>buildLogo</code> produced; nothing is redrawn here.</p>
  </div>
</div>
<script type="module">
import * as THREE from "${dataUrl(three)}";
const DATA = ${JSON.stringify(data)};
const f32 = (s) => { const b = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new Float32Array(b.buffer, 0, b.byteLength / 4); };
const geometries = DATA.pieces.map((p) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f32(p.position64), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(f32(p.normal64), 3));
  return g;
});
function scene(lit) {
  const s = new THREE.Scene();
  const group = new THREE.Group();
  DATA.pieces.forEach((p, i) => {
    // Lit cells take the given standard props; the detail cell, lit only to show
    // the bevel, lowers roughness so a black edge still catches the light.
    const material = lit
      ? new THREE.MeshStandardMaterial({ color: p.tone, ...(DATA.standard || { roughness: 0.35 }) })
      : new THREE.MeshBasicMaterial({ color: p.tone, toneMapped: false });
    const mesh = new THREE.Mesh(geometries[i], material);
    mesh.name = p.name;
    mesh.position.fromArray(p.position);
    mesh.scale.setScalar(p.width);
    group.add(mesh);
  });
  s.add(group);
  if (lit) {
    s.add(new THREE.AmbientLight(0xffffff, DATA.ambient));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.fromArray(DATA.light);
    s.add(sun);
  }
  return s;
}
DATA.cells.forEach((c, i) => {
  const canvas = document.getElementById('c' + i);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(DATA.W, DATA.H, false);
  renderer.setClearColor(DATA.ground, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // what a fiber Canvas sets
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.PerspectiveCamera(DATA.fov, DATA.W / DATA.H, 0.01, 100);
  camera.position.fromArray(c.position);
  camera.lookAt(...c.target);
  renderer.render(scene(c.lit), camera);
});
window.__rendered = true;
</script>
</body>
</html>
`
}

/** The Chromium to use, or null. */
export function findBrowser(given) {
  for (const p of [given, process.env.COCOON_BROWSER, ...BROWSERS])
    if (p && existsSync(p)) return p
  return null
}

/** Screenshot the page's #sheet with a headless Chromium. Returns the PNG buffer. */
export async function screenshot(htmlPath, browser) {
  const { default: puppeteer } = await import('puppeteer-core')
  const b = await puppeteer.launch({
    executablePath: browser,
    headless: true,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
    ],
  })
  try {
    const page = await b.newPage()
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 })
    await page.goto(pathToFileURL(resolve(htmlPath)).href, {
      waitUntil: 'load',
    })
    await page.waitForFunction('window.__rendered === true', {
      timeout: 60_000,
    })
    const sheet = await page.$('#sheet')
    return await sheet.screenshot({ type: 'png', omitBackground: false })
  } finally {
    await b.close()
  }
}

/** Write `<name>.html` and, with a browser, `<name>.png` into `out`. */
export async function run(o) {
  const p = plan(o)
  mkdirSync(o.out, { recursive: true })
  const paths = { html: join(o.out, `${o.name}.html`), png: null }
  writeFileSync(paths.html, html(p.data))
  const browser = findBrowser(o.browser)
  if (browser) {
    paths.png = join(o.out, `${o.name}.png`)
    writeFileSync(paths.png, await screenshot(paths.html, browser))
  }
  return { paths, browser, ...p }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2))
  if (o.help) {
    console.log(help())
    process.exit(0)
  }
  const r = await run(o)
  console.log(
    `${r.logo.options.view}: ${r.vertices.reduce((s, v) => s + v, 0)} vertices, built in ${r.buildMs.toFixed(1)} ms`,
  )
  console.log(
    `camera: fov ${r.camera.fov} deg, distance ${r4(r.camera.distance)}; the back plane reads ${(r.back * 100).toFixed(2)} % of the front head on`,
  )
  console.log(r.paths.html)
  if (r.paths.png) console.log(`${r.paths.png}   (${r.browser})`)
  else
    console.log(
      'no Chromium found: open the html in a browser, or pass --browser <executable> for the png',
    )
}
