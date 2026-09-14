/**
 * The logo as pieces for the mesh: where each plane and the wordmark sit,
 * how wide they are, what tone they take, and their extruded geometry.
 *
 * Layout runs in the artwork's own units first: the triangle's 1000 box for
 * the icon view, the wordmark's font units for the lockup, the icon scaled
 * and placed by the same rule `assets/logo/lockup.js` ships. The ink's
 * bounding box is then centred on the origin and scaled so its width is
 * `width` world units. Every piece's geometry is normalised on its own,
 * larger xy extent 1 and centred on all three axes, and the mesh that holds
 * it is scaled uniformly by the piece's world width, so a bevel stays round.
 *
 * No React here: the component renders what this returns, and the export
 * script draws it, so the two cannot differ.
 */
import { ExtrudeGeometry, Path, Shape } from 'three'
import {
  HAZE_CUTS,
  HAZE_DEFAULTS,
  hazeProfile,
  hazeTones,
} from '../utils/hazePlanes.js'
import { simplifyPolyline } from '../utils/simplifyPolyline.js'
import { LOGO } from './logo.js'

/** The scene keys the `scene` prop may carry; the rest of HAZE_DEFAULTS is CSS. */
export const SCENE_KEYS = ['planes', 'depth', 'radius', 'angle', 'perspective']

export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  view: 'lockup',
  width: 1,
  depth: null, // DEPTH_RATIO of the ink height
  maxSize: 1000,
  eps: 0.25,
  scene: null,
  cut: 'vapour',
  haze: null,
  reverse: false,
  surface: HAZE_DEFAULTS.surface,
  ground: HAZE_DEFAULTS.ground,
  size: 1,
  air: 2,
  gap: null,
  extrudeOptions: null,
})

/** The group's z extent as a fraction of the ink height, when `depth` is unset. */
export const DEPTH_RATIO = 1 / 4
/** Bevel radius as a fraction of one triangle's depth, the same on every piece. */
export const BEVEL_RATIO = 0.3
export const BEVEL_SEGMENTS = 3

function positive(o, key) {
  if (!(o[key] > 0))
    throw new Error(`CocoonLogoGroup: ${key} must be > 0, got ${o[key]}`)
}

function nonNegative(o, key) {
  if (o[key] != null && !(o[key] >= 0))
    throw new Error(`CocoonLogoGroup: ${key} must be >= 0, got ${o[key]}`)
}

/**
 * Fill in defaults and validate. Throws naming the prop.
 * @param {object} [props]
 * @returns {object} a complete option set with `scene` filled from HAZE_DEFAULTS
 */
export function resolveLogo(props = {}) {
  const o = { ...DEFAULTS, ...props }
  if (o.view !== 'lockup' && o.view !== 'icon')
    throw new Error(
      `CocoonLogoGroup: view must be 'lockup' or 'icon', got ${JSON.stringify(o.view)}`,
    )
  const scene = {}
  for (const k of SCENE_KEYS) scene[k] = o.scene?.[k] ?? HAZE_DEFAULTS[k]
  if (!(scene.planes >= 1) || scene.planes % 1 !== 0)
    throw new Error(
      `CocoonLogoGroup: scene.planes must be a whole number >= 1, got ${scene.planes}`,
    )
  o.scene = scene
  positive(o, 'width')
  if (o.depth != null) positive(o, 'depth')
  positive(o, 'maxSize')
  nonNegative(o, 'eps')
  positive(o, 'size')
  nonNegative(o, 'air')
  nonNegative(o, 'gap')
  if (!(o.cut in HAZE_CUTS))
    throw new Error(`CocoonLogoGroup: unknown cut "${o.cut}"`)
  return o
}

/** The tone ramp, near plane first; a lone plane is the surface itself. */
export function logoTones(o) {
  const surface = o.reverse ? o.ground : o.surface
  const ground = o.reverse ? o.surface : o.ground
  if (o.scene.planes < 2) {
    hazeTones({ planes: 2, cut: o.cut, surface, ground }) // validates the colours
    return [surface]
  }
  return hazeTones({
    planes: o.scene.planes,
    ...(o.haze == null ? { cut: o.cut } : { haze: o.haze }),
    surface,
    ground,
  })
}

const bounds = (pts) => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

const union = (a, b) => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
]

const transformBounds = ([x0, y0, x1, y1], s, [ox, oy]) => [
  x0 * s + ox,
  y0 * s + oy,
  x1 * s + ox,
  y1 * s + oy,
]

/**
 * The layout in world units, geometry aside: one entry per piece with its
 * outlines still in the piece's own design units, the scale and offset that
 * place it in the common design space, and its world width, position, depth
 * and tone. Also the group's width, height, depth, the tones, and the
 * lockup's gap in stems.
 * @param {object} o resolved options
 */
export function layoutLogo(o) {
  const { scene } = o
  const T = LOGO.triangle
  const tones = logoTones(o)
  const rad = (scene.angle * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = -Math.sin(rad) // y up: angle 90 is down
  const W = T.box
  const sharpB = bounds(T.sharp)
  const outlineB = bounds(T.outline)
  const planes = []
  for (let k = 0; k < scene.planes; k++) {
    const f = hazeProfile(k, scene.planes, scene.perspective)
    const S = 1 - (1 - scene.depth) * f
    const d = scene.radius * f * W
    planes.push({ k, scale: S, offset: [d * ux, d * uy] })
  }
  // Sharp bounds of the icon and of its front triangle, in icon units.
  const iconB = planes
    .map((p) => transformBounds(sharpB, p.scale, p.offset))
    .reduce(union)
  const frontB = transformBounds(sharpB, 1, [0, 0])

  const pieces = []
  let gap = null
  if (o.view === 'icon') {
    for (const p of planes)
      pieces.push({
        name: `plane${p.k}`,
        outer: T.outline,
        holes: [],
        localBounds: outlineB,
        scale: p.scale,
        offset: p.offset,
        tone: tones[p.k],
        k: p.k,
      })
  } else {
    const Wm = LOGO.wordmark
    const XH = Wm.xHeight.top - Wm.xHeight.bottom
    const XH_MID = (Wm.xHeight.top + Wm.xHeight.bottom) / 2
    const iconH = iconB[3] - iconB[1]
    const kIcon = (o.size * XH) / iconH
    // The shipped rule: the trail at the largest of the shipped sizes and this one.
    if (o.gap == null) {
      const trail = iconB[2] - frontB[2]
      const frontH = frontB[3] - frontB[1]
      const worst =
        (trail * ((Math.max(...LOGO.sizes, o.size) * XH) / frontH)) / Wm.stem
      gap = Math.ceil((o.air + worst) * 4) / 4
    } else gap = o.gap
    const ty = XH_MID - (kIcon * (iconB[1] + iconB[3])) / 2
    const tx = Wm.bounds[0] - gap * Wm.stem - kIcon * frontB[2]
    for (const p of planes)
      pieces.push({
        name: `plane${p.k}`,
        outer: T.outline,
        holes: [],
        localBounds: outlineB,
        scale: p.scale * kIcon,
        offset: [tx + kIcon * p.offset[0], ty + kIcon * p.offset[1]],
        tone: tones[p.k],
        k: p.k,
      })
    for (const g of Wm.groups)
      pieces.push({
        name: 'wordmark',
        outer: g.outer,
        holes: g.holes,
        localBounds: Wm.bounds,
        scale: 1,
        offset: [0, 0],
        tone: tones[0],
        k: null,
      })
  }

  // The ink box in the common design space; centred, then scaled to `width`.
  const inkB = pieces
    .map((p) => transformBounds(p.localBounds, p.scale, p.offset))
    .reduce(union)
  const inkW = inkB[2] - inkB[0]
  const inkH = inkB[3] - inkB[1]
  const cx = (inkB[0] + inkB[2]) / 2
  const cy = (inkB[1] + inkB[3]) / 2
  const perUnit = o.width / inkW
  const height = inkH * perUnit
  const depth = o.depth ?? height * DEPTH_RATIO
  const dt = depth / scene.planes

  for (const p of pieces) {
    const [x0, y0, x1, y1] = p.localBounds
    p.extent = Math.max(x1 - x0, y1 - y0)
    p.localCentre = [(x0 + x1) / 2, (y0 + y1) / 2]
    p.width = p.extent * p.scale * perUnit
    p.depth = p.k == null ? depth : dt
    p.position = [
      (p.localCentre[0] * p.scale + p.offset[0] - cx) * perUnit,
      (p.localCentre[1] * p.scale + p.offset[1] - cy) * perUnit,
      p.k == null ? -depth / 2 : -(p.k + 0.5) * dt,
    ]
    // Chord error in the piece's own units: eps px at maxSize px of ink width.
    p.eps = (o.eps * (inkW / o.maxSize)) / p.scale
  }
  return {
    pieces,
    width: o.width,
    height,
    depth,
    tones,
    gap,
    inkW,
    inkH,
    perUnit,
    centre: [cx, cy],
  }
}

/** Extrusion options for a piece, geometry units, the caller's merged last. */
export function extrudeOptions(p, dt, overrides) {
  let b = BEVEL_RATIO * dt
  if (2 * b >= p.depth) b = 0.45 * p.depth // a bevel can never eat the piece
  const g = 1 / p.width
  return {
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelSegments: BEVEL_SEGMENTS,
    bevelThickness: b * g,
    bevelSize: b * g,
    bevelOffset: -b * g,
    depth: (p.depth - 2 * b) * g,
    ...(overrides ?? null),
  }
}

/**
 * The piece's outlines simplified to its eps and normalised: the simplified
 * outer's larger extent becomes 1 and its box centre the origin, so the
 * geometry is exactly its own ink. Returns { shape, extent, centre } with
 * the measures in the piece's design units.
 */
function shapeFrom(p, frame) {
  const outer = simplifyPolyline(p.outer, p.eps)
  const holes = p.holes.map((h) => simplifyPolyline(h, p.eps))
  if (!frame) {
    const [x0, y0, x1, y1] = bounds(outer)
    frame = {
      extent: Math.max(x1 - x0, y1 - y0),
      centre: [(x0 + x1) / 2, (y0 + y1) / 2],
    }
  }
  const norm = (pts) =>
    pts.map(([x, y]) => [
      (x - frame.centre[0]) / frame.extent,
      (y - frame.centre[1]) / frame.extent,
    ])
  const trace = (path, pts) => {
    pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
    path.closePath()
    return path
  }
  const shape = trace(new Shape(), norm(outer))
  for (const h of holes) shape.holes.push(trace(new Path(), norm(h)))
  return { shape, ...frame }
}

/**
 * The pieces with their geometry: one ExtrudeGeometry each, normalised and
 * centred on all three axes, plus the group's measures. The caller owns the
 * geometries' disposal.
 * @param {object} [props] the component's props
 * @returns {{ pieces: object[], width: number, height: number, depth: number, tones: string[], gap: number | null, options: object, layout: object }}
 */
export function buildLogo(props) {
  const o = resolveLogo(props)
  const L = layoutLogo(o)
  const dt = L.depth / o.scene.planes
  const wordmark = L.pieces.filter((p) => p.k == null)
  const out = []
  const make = (shapes, p, frame) => {
    // The mesh is as wide as the simplified ink, which sits within eps of the
    // dense outline the layout measured.
    const piece = {
      ...p,
      width: frame.extent * p.scale * perUnit,
      position: [
        (frame.centre[0] * p.scale + p.offset[0] - cx) * perUnit,
        (frame.centre[1] * p.scale + p.offset[1] - cy) * perUnit,
        p.position[2],
      ],
    }
    const extrude = extrudeOptions(piece, dt, o.extrudeOptions)
    const geometry = new ExtrudeGeometry(shapes, extrude)
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox
    geometry.translate(
      -(bb.min.x + bb.max.x) / 2,
      -(bb.min.y + bb.max.y) / 2,
      -(bb.min.z + bb.max.z) / 2,
    )
    geometry.computeBoundingBox()
    return {
      name: piece.name,
      k: piece.k,
      geometry,
      extrude,
      width: piece.width,
      depth: piece.depth,
      position: piece.position,
      tone: piece.tone,
    }
  }
  const {
    perUnit,
    centre: [cx, cy],
  } = L
  for (const p of L.pieces)
    if (p.k != null) {
      const { shape, ...frame } = shapeFrom(p)
      out.push(make([shape], p, frame))
    }
  if (wordmark.length) {
    // One geometry for the wordmark: its contours share one frame, the
    // simplified ink box of all of them together.
    const simplified = wordmark.map((p) => simplifyPolyline(p.outer, p.eps))
    const [x0, y0, x1, y1] = bounds(simplified.flat())
    const frame = {
      extent: Math.max(x1 - x0, y1 - y0),
      centre: [(x0 + x1) / 2, (y0 + y1) / 2],
    }
    out.push(
      make(
        wordmark.map((p) => shapeFrom(p, frame).shape),
        wordmark[0],
        frame,
      ),
    )
  }
  return {
    pieces: out,
    width: L.width,
    height: L.height,
    depth: L.depth,
    tones: L.tones,
    gap: L.gap,
    options: o,
    layout: L,
  }
}
