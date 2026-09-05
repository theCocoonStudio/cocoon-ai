/**
 * The cocoon four-plane recession as a scene, and the CSS that expresses it.
 *
 * A row of identical copies of an element stands one behind another, seen by
 * a camera off to one side through haze. Every input is a thing in that scene:
 * how many copies, how far apart, how far away and how far aside the camera
 * is, how thick the air. Offsets, spreads and tones are derived from it.
 *
 * All distances are in element widths, so a scene survives any resize.
 *
 *     S_k    = distance / (distance + k * spacing)     projected size of plane k
 *     spread = -(1 - S_k) * width / 2                  shrink the box
 *     offset =  cameraX * (1 - S_k) * width            slide it toward the axis
 *     L_k    = L_surface * T^k + L_ground * (1 - T^k)  mixed in linear light
 *     T      = haze^(1 / (planes - 1))
 *
 * Which lever to reach for:
 *   too flat or too busy ...... spacing    the gap between copies
 *   recession too abrupt ...... distance   a longer lens calms the steps
 *   copies hiding behind ...... cameraX    how far the camera stands aside
 *   fade too fast or slow ..... haze       thickness of the air
 *   more or fewer copies ...... planes
 *
 * The same scene cuts the logo and the icon set; the generators under assets/
 * read their constants from here so the three cannot drift.
 */

/** House scene and subject defaults. */
export const HAZE_DEFAULTS = Object.freeze({
  planes: 4,
  spacing: 1,
  distance: 6,
  cameraX: 1.3,
  haze: 0.275 ** 2,
  width: 48,
  height: null,
  radius: 0,
  surface: '#141414',
  ground: '#FFFFFF',
  technique: 'auto',
  tolerance: 1,
  selector: '.haze',
  responsive: false,
  precision: 4,
  comment: true,
})

/** Named haze totals: the fraction of surface radiance surviving the whole row. */
export const HAZE_CUTS = Object.freeze({
  vapour: 0.275 ** 2,
  dense: 0.15 ** 2,
})

// ---- colour ----------------------------------------------------------------

function parseHex(s) {
  let h = String(s).trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (!/^[0-9a-fA-F]{6}$/.test(h))
    throw new Error(`hazePlanes: bad colour "${s}"`)
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function toHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0')
          .toUpperCase(),
      )
      .join('')
  )
}

function srgbToLinear(c) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(v) {
  v = Math.max(0, Math.min(1, v))
  return Math.round(
    255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055),
  )
}

// ---- options ---------------------------------------------------------------

/**
 * Fill in defaults and validate. `cut` sets `haze` by name.
 * @param {object} [opts]
 * @returns {object} a complete option set
 */
export function hazeResolve(opts) {
  const o = { ...HAZE_DEFAULTS, ...opts }
  if (typeof o.cut === 'string') {
    if (!(o.cut in HAZE_CUTS))
      throw new Error(`hazePlanes: unknown cut "${o.cut}"`)
    o.haze = HAZE_CUTS[o.cut]
  }
  if (o.height == null) o.height = o.width
  if (!(o.width > 0)) throw new Error('hazePlanes: width must be > 0')
  if (!(o.planes >= 2)) throw new Error('hazePlanes: planes must be >= 2')
  if (!(o.spacing > 0)) throw new Error('hazePlanes: spacing must be > 0')
  if (!(o.distance > 0)) throw new Error('hazePlanes: distance must be > 0')
  if (!(o.haze > 0 && o.haze < 1))
    throw new Error('hazePlanes: haze must be in (0, 1)')
  return o
}

// ---- scene -----------------------------------------------------------------

/**
 * The tone ramp, near plane first. Mixed in linear light and only then encoded
 * to sRGB; compositing in gamma space is why distant objects come out too dark.
 * @param {object} [opts] scene options; `surface`, `ground`, `planes`, `haze` or `cut`
 * @returns {string[]} one hex colour per plane
 */
export function hazeTones(opts) {
  const o = hazeResolve(opts)
  const s = parseHex(o.surface)
  const g = parseHex(o.ground)
  const T = o.haze ** (1 / (o.planes - 1))
  const out = []
  for (let k = 0; k < o.planes; k++) {
    const t = T ** k
    const rgb = []
    for (let i = 0; i < 3; i++)
      rgb.push(
        linearToSrgb(srgbToLinear(s[i]) * t + srgbToLinear(g[i]) * (1 - t)),
      )
    out.push(toHex(rgb))
  }
  return out
}

/**
 * Per-plane geometry, tones, and how far a box-shadow rendering misses the
 * true scaled copy.
 *
 * A box-shadow spread is an isotropic outset; a plane is a scale. They agree
 * only on a square with sharp corners or a full circle, so each plane reports:
 *   heightError  (1 - S) * |W - H|, zero only when W === H
 *   radiusError  |S * r - max(0, r + spread)|, zero at r = 0 and r = W / 2
 *   clears       how far the plane escapes the element's own border box; a
 *                shadow under the box is never drawn, so <= 0 means hidden
 *
 * @param {object} [opts] scene and subject options
 * @returns {{ opts: object, planes: object[], tones: string[], worstError: number, hidden: number[], ok: boolean }}
 *   `planes` holds k = 1 .. planes-1 with scale, offset, spread and the errors;
 *   `hidden` lists planes that do not clear the box; `ok` is true when
 *   box-shadow is within `tolerance` and `cameraX` exceeds 0.5
 */
export function hazeAnalyse(opts) {
  const o = hazeResolve(opts)
  const { width: W, height: H, radius: r } = o
  const planes = []
  for (let k = 1; k < o.planes; k++) {
    const scale = o.distance / (o.distance + k * o.spacing)
    const u = 1 - scale
    const spread = (-u * W) / 2
    const offset = o.cameraX * u * W
    planes.push({
      k,
      scale,
      offset,
      spread,
      heightError: Math.abs(H + 2 * spread - H * scale),
      radiusError: Math.abs(r * scale - Math.max(0, r + spread)),
      clears: offset + (W + 2 * spread) / 2 - W / 2,
    })
  }
  const worstError = planes.reduce(
    (a, p) => Math.max(a, p.heightError, p.radiusError),
    0,
  )
  return {
    opts: o,
    planes,
    tones: hazeTones(o),
    worstError,
    hidden: planes.filter((p) => p.clears <= 0).map((p) => p.k),
    ok: worstError <= o.tolerance && o.cameraX > 0.5,
  }
}

/**
 * The widest plane spacing whose worst box-shadow error stays within a pixel
 * budget. Error grows monotonically with spacing, so this bisects. Returns the
 * given spacing when the geometry is already clean there.
 * @param {object} [opts]
 * @param {number} [tolerancePx] defaults to `opts.tolerance`
 * @returns {number}
 */
export function hazeMaxSpacing(opts, tolerancePx) {
  const o = hazeResolve(opts)
  const tol = tolerancePx == null ? o.tolerance : tolerancePx
  const err = (spacing) => hazeAnalyse({ ...o, spacing }).worstError
  if (err(o.spacing) <= tol) return o.spacing
  let lo = 0
  let hi = o.spacing
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if (err(m) <= tol) lo = m
    else hi = m
  }
  return lo
}

// ---- CSS -------------------------------------------------------------------

function len(v, o) {
  if (o.responsive) {
    const n = Number((v / o.width).toFixed(6))
    return n === 0 ? '0' : `calc(var(--haze-w) * ${n})`
  }
  return Number(v.toFixed(o.precision)) === 0
    ? '0'
    : `${v.toFixed(o.precision)}px`
}

function boxShadowRule(a) {
  const o = a.opts
  const rules = a.planes.map(
    (p) => `    ${len(p.offset, o)} 0 0 ${len(p.spread, o)} ${a.tones[p.k]}`,
  )
  return (
    `${o.selector} {\n` +
    (o.responsive ? `  --haze-w: ${o.width}px;\n` : '') +
    `  background: ${a.tones[0]};\n` +
    `  box-shadow:\n${rules.join(',\n')};\n}\n`
  )
}

/*
 * Exact for any shape and aspect: every plane, including the element's own
 * face, is a real copy scaled about the camera's principal point.
 *
 * No z-index, deliberately. Keeping the background on the element and pushing
 * copies behind it with z-index:-1 breaks two opposite ways: `isolation:
 * isolate` on the element makes it the stacking context root, so its
 * background paints first and the copies land in front; without it the copies
 * drop to the ancestor's negative-z step and vanish behind the first ancestor
 * that paints a background. Siblings in back-to-front DOM order have neither
 * failure mode: first child is the furthest plane, last is the face.
 */
function transformRules(a) {
  const o = a.opts
  const sel = o.selector
  const base = sel.replace(/^[.#]/, '')
  const plane = `${base}-plane`
  const content = `${base}-content`
  const all = [{ k: 0, scale: 1 }, ...a.planes]
  const out = [
    `${sel} {\n  position: relative;\n  background: none;\n}\n`,
    `${sel} > .${plane} {\n  position: absolute;\n  inset: 0;\n` +
      `  border-radius: inherit;\n  transform-origin: ` +
      `${Number((o.cameraX * 100 + 50).toFixed(4))}% 50%;\n}\n`,
  ]
  all
    .slice()
    .reverse()
    .forEach((p, i) => {
      const note =
        p.k === 0 ? ", the element's own face" : i === 0 ? ', the furthest' : ''
      out.push(
        `${sel} > .${plane}:nth-child(${i + 1}) {   /* plane ${p.k}${note} */\n` +
          `  background: ${a.tones[p.k]};\n` +
          (p.k === 0
            ? ''
            : `  transform: scale(${Number(p.scale.toFixed(6))});\n`) +
          `}\n`,
      )
    })
  out.push(
    `${sel} > .${content} {\n  position: relative;   /* above the planes */\n}\n`,
  )
  out.push(
    `/* markup, back to front:\n   <div class="${base}">\n` +
      all.map(() => `     <i class="${plane}"></i>\n`).join('') +
      `     <span class="${content}">...</span>\n   </div> */\n`,
  )
  return out.join('\n')
}

function header(a, chosen) {
  const o = a.opts
  const r6 = (v) => Number(v.toFixed(6))
  const L = [
    `/* hazePlanes - ${chosen}`,
    ' *',
    ` * scene    ${o.planes} planes, spacing ${r6(o.spacing)}w, distance ${r6(o.distance)}w, cameraX ${r6(o.cameraX)}w`,
    ` * air      haze ${r6(o.haze)}, so T = ${r6(o.haze ** (1 / (o.planes - 1)))} per gap`,
    ` * subject  ${o.width} x ${o.height}, radius ${o.radius}, ${a.tones[0]} on ${o.ground}`,
    ` * gives    scales ${a.planes.map((p) => Number(p.scale.toFixed(4))).join(' : ')}`,
    ` *          ramp   ${a.tones.join(' -> ')}`,
  ]
  if (chosen === 'box-shadow') {
    L.push(' *')
    L.push(
      ` * fidelity worst geometric error ${Number(a.worstError.toFixed(2))}px, ` +
        `${a.worstError <= o.tolerance ? 'within' : 'OVER'} tolerance ${o.tolerance}px`,
    )
    if (o.height !== o.width) {
      const last = a.planes[a.planes.length - 1]
      L.push(
        ` *          NOT SQUARE - spread is an isotropic outset, so the far plane is ` +
          `${Number((o.height + 2 * last.spread).toFixed(1))}px tall where a true scale gives ` +
          `${Number((o.height * last.scale).toFixed(1))}px`,
      )
    }
    if (a.worstError > o.tolerance)
      L.push(
        ` *          spacing <= ${Number(hazeMaxSpacing(o, o.tolerance).toFixed(3))}w ` +
          'would bring it inside tolerance, at the cost of the recession',
      )
    if (o.cameraX <= 0.5)
      L.push(
        ' *          cameraX <= 0.5w - every plane hides under the border box and is knocked out',
      )
    else if (a.hidden.length)
      L.push(
        ` *          planes ${a.hidden.join(', ')} do not clear the element edge and will not draw`,
      )
  } else {
    L.push(' *')
    L.push(
      ` * fidelity exact for any shape and aspect; costs ${a.planes.length} extra elements`,
    )
  }
  L.push(' */')
  return L.join('\n') + '\n'
}

/**
 * The scene as CSS text. `technique: 'auto'` emits box-shadow where the
 * geometry supports it within `tolerance` and the transform stack otherwise.
 * @param {object} [opts]
 * @returns {string}
 */
export function hazeShadow(opts) {
  const a = hazeAnalyse(opts)
  const o = a.opts
  const chosen =
    o.technique === 'auto' ? (a.ok ? 'box-shadow' : 'transform') : o.technique
  if (chosen !== 'box-shadow' && chosen !== 'transform')
    throw new Error(`hazePlanes: unknown technique "${o.technique}"`)
  return (
    (o.comment ? header(a, chosen) + '\n' : '') +
    (chosen === 'box-shadow' ? boxShadowRule(a) : transformRules(a))
  )
}
