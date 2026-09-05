/**
 * The build's guards. Each is a pure function over data and throws when the
 * property it guards is false, so the build can refuse and the tests can feed
 * each one the exact defect it exists to catch.
 */
import * as H from '../lib/haze.js'
import { BAR } from './shapes.js'

const key = (paths) => JSON.stringify(paths)

/** The shipped face must be character for character plane 0 of the haze scene. */
export function checkFrontIsPlane0(set, front = H.front) {
  const bad = []
  for (const [name, [fn, opts]] of Object.entries(set)) {
    const shape = fn()
    const mine = front(shape, { origin: 'scene', ...opts }).pieces[0].paths
    const theirs = H.build(shape, opts).pieces[0].paths
    if (key(mine) !== key(theirs)) bad.push(name)
  }
  if (bad.length)
    throw new Error(
      `front face has drifted from plane 0 of the haze scene: ${bad.join(', ')}`,
    )
  return Object.keys(set).length
}

/** Re-cutting the set needs only BAR changed: every icon must respond to it. */
export function checkBarIsLive(set, bar = BAR) {
  const render = (b) =>
    Object.fromEntries(
      Object.entries(set).map(([n, [fn, o]]) => [
        n,
        key(H.front(fn(b), { square: true, ...o }).pieces[0].paths),
      ]),
    )
  const before = render(bar)
  const after = render(bar * 0.8667)
  const deaf = Object.keys(before).filter((n) => before[n] === after[n])
  if (deaf.length)
    throw new Error(
      `BAR is not live for: ${deaf.join(', ')}\n  the spec's re-cutting instruction is false for those icons.`,
    )
  return Object.keys(before).length
}

const viewBoxOf = (text) =>
  text
    .match(/viewBox="([^"]+)"/)[1]
    .split(' ')
    .map(Number)
const pathsOf = (text) =>
  [...text.matchAll(/ d="([^"]+)"/g)].map((m) => ({ d: m[1] }))

/**
 * Both viewBoxes must be what the spec says, measured off the ink after
 * translation against the viewBox actually written to the file. Tight equals
 * the ink box on all four sides; square has the longer ink side and the ink
 * centred on the shorter axis. `files` maps file name to text.
 */
export function checkBoxes(set, files, front = H.front) {
  const TOL = 2e-3 // the serialisation floor at 3 decimals, not a fudge
  const SERIALISED = 1
  const rows = []
  const bad = []
  for (const [name, [fn, opts]] of Object.entries(set)) {
    const shape = fn()
    const [, , w, h] = front(shape, { origin: 'scene', prec: 12, ...opts }).ink
    const t = Math.max(w, h)
    for (const [kind, square, file] of [
      ['tight', false, `icon-${name}.svg`],
      ['square', true, `icon-${name}-square.svg`],
    ]) {
      const { viewBox: vb, ink } = front(shape, { square, prec: 12, ...opts })
      const text = files[file]
      if (text == null) {
        bad.push(`${file}: missing`)
        continue
      }
      const vf = viewBoxOf(text)
      const got = H.pathsBounds(pathsOf(text))
      const drift = Math.max(...got.map((v, i) => Math.abs(v - ink[i])))
      if (drift > SERIALISED)
        bad.push(
          `${name} ${kind}: serialised outline is ${drift.toFixed(3)} units from the exact one`,
        )
      // The file's own ink against the file's own viewBox: the output, not the
      // model. Looser than TOL because a 3-decimal arc rebuilds imprecisely.
      const fl = got[0] - vf[0]
      const fr = vf[0] + vf[2] - (got[0] + got[2])
      const ft = got[1] - vf[1]
      const fb = vf[1] + vf[3] - (got[1] + got[3])
      if (Math.abs(fl - fr) > SERIALISED || Math.abs(ft - fb) > SERIALISED)
        bad.push(
          `${name} ${kind}: ink not centred in the file (l ${fl.toFixed(3)} r ${fr.toFixed(3)} t ${ft.toFixed(3)} b ${fb.toFixed(3)})`,
        )
      if (vf.some((v, i) => v !== Number(vb[i].toFixed(3))))
        bad.push(
          `${name} ${kind}: file viewBox ${vf} != emitted ${vb.map((v) => v.toFixed(3))}`,
        )
      const left = ink[0] - vb[0]
      const top = ink[1] - vb[1]
      const right = vb[0] + vb[2] - (ink[0] + ink[2])
      const bottom = vb[1] + vb[3] - (ink[1] + ink[3])
      const where = `(l ${left.toFixed(3)} r ${right.toFixed(3)} t ${top.toFixed(3)} b ${bottom.toFixed(3)})`
      if (Math.min(left, right, top, bottom) < -TOL)
        bad.push(`${name} ${kind}: ink outside the viewBox ${where}`)
      if (Math.abs(left - right) > TOL || Math.abs(top - bottom) > TOL)
        bad.push(`${name} ${kind}: ink not centred ${where}`)
      if (kind === 'tight' && Math.max(left, right, top, bottom) > TOL)
        bad.push(`${name} tight: viewBox is not the ink box ${where}`)
      if (kind === 'square') {
        if (vb[2] !== vb[3])
          bad.push(`${name}: square viewBox is not square: ${vb}`)
        if (Math.abs(vb[2] - t) > TOL)
          bad.push(
            `${name}: square side ${vb[2].toFixed(3)} != longer ink side ${t.toFixed(3)}`,
          )
        rows.push({
          name,
          w,
          h,
          left,
          top,
          side: vb[2],
          off: Math.max(Math.abs(left - right), Math.abs(top - bottom)),
        })
      }
    }
  }
  if (bad.length) throw new Error(`viewBox FAILED:\n  ${bad.join('\n  ')}`)
  return rows
}

/** Two icon names for one picture is a naming error. */
export function checkNoDuplicates(set, files) {
  const seen = new Map()
  const same = []
  for (const name of Object.keys(set)) {
    const body = files[`icon-${name}.svg`]
    const square = files[`icon-${name}-square.svg`]
    if (body === square) same.push(name)
    seen.set(square, [...(seen.get(square) || []), name])
  }
  const dupes = [...seen.values()].filter((v) => v.length > 1)
  if (dupes.length)
    throw new Error(
      `different icon names, identical picture: ${dupes.map((d) => d.join(', ')).join('; ')}`,
    )
  return { distinct: seen.size, squareAlready: same }
}

/** No file may carry a colour. */
export function checkColour(files) {
  const bad = []
  for (const [name, s] of Object.entries(files)) {
    if (s.includes('#')) bad.push(`${name} contains a hex colour`)
    const fills = (s.match(/fill="/g) || []).length
    const current = (s.match(/fill="currentColor"/g) || []).length
    if (fills !== current)
      bad.push(`${name} has a fill that is not currentColor`)
  }
  if (bad.length) throw new Error(`colour FAILED:\n  ${bad.join('\n  ')}`)
  return Object.keys(files).length
}

/** Everything the build checks, in order. Returns the ledger rows. */
export function runGuards(set, files) {
  const ledger = []
  const n = checkFrontIsPlane0(set)
  ledger.push([
    'ran',
    'front face == plane 0 of the haze scene',
    `all ${n} icons, path strings identical`,
  ])
  const nb = checkBarIsLive(set)
  ledger.push([
    'ran',
    'one stroke weight, live for every icon',
    `BAR 0.15 -> 0.13 changes all ${nb} icons`,
  ])
  const rows = checkBoxes(set, files)
  const sides = rows.map((r) => r.side)
  const worst = Math.max(...rows.map((r) => r.off))
  ledger.push([
    'ran',
    'viewBox flush / square / centred',
    `square sides ${Math.min(...sides).toFixed(1)}-${Math.max(...sides).toFixed(1)}, worst |left-right| or |top-bottom| ${worst.toExponential(2)} units, tolerance 2e-3`,
  ])
  const { distinct, squareAlready } = checkNoDuplicates(set, files)
  ledger.push([
    'ran',
    'no two icon names, one picture',
    `${distinct} distinct pictures across ${Object.keys(set).length} icons`,
  ])
  const nf = checkColour(files)
  ledger.push([
    'ran',
    'no colour in any file',
    `${nf} files, every fill currentColor, no hex`,
  ])
  return { ledger, rows, squareAlready }
}
