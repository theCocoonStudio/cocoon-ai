import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as H from '../lib/haze.js'
import { BAR, SET, arrowLeft, settings } from './shapes.js'
import {
  checkBarIsLive,
  checkBoxes,
  checkColour,
  checkFrontIsPlane0,
  checkNoDuplicates,
  runGuards,
} from './guards.js'
import { contactSheet, renderSet } from './build.js'

const here = dirname(fileURLToPath(import.meta.url))
const files = renderSet()

const withViewBox = (text, vb) =>
  text.replace(/viewBox="[^"]+"/, `viewBox="${vb}"`)

describe('the shipped files', () => {
  it('are exactly what the build emits (rebuild before committing a shape change)', () => {
    const shipped = readdirSync(here).filter((f) => /^icon-.*\.svg$/.test(f))
    expect(shipped.sort()).toEqual(Object.keys(files).sort())
    for (const f of shipped)
      expect(readFileSync(join(here, f), 'utf8'), f).toBe(files[f])
  })

  it('pass every guard', () => {
    const { ledger } = runGuards(SET, files)
    expect(ledger.filter((r) => r[0] === 'ran')).toHaveLength(5)
  })

  it('carry the contact sheet the build emits', () => {
    expect(readFileSync(join(here, 'preview.html'), 'utf8')).toBe(
      contactSheet(),
    )
  })
})

describe('the engine', () => {
  it('projects to 1 : 6/7 : 3/4 : 2/3', () => {
    expect(H.scales()).toEqual([1, 6 / 7, 3 / 4, 2 / 3])
  })

  it('puts every plane centroid on one level line', () => {
    for (const { elems } of H.place(settings()))
      expect(H.centroid(elems)[1]).toBeCloseTo(0, 6)
  })

  it('measures the drawn outline, not the polygon', () => {
    const { ink } = H.front(SET['arrow-up'][0](), { origin: 'scene' })
    const poly = H.bounds(H.place(SET['arrow-up'][0](), { n: 1 })[0].elems)
    expect(ink[2]).toBeLessThan(poly[2]) // fillets cut the tips inward
  })
})

// A guard that has never failed is not a guard. Each one gets the defect it
// exists to catch, built from data rather than by editing source.
describe('guards proven capable of failing', () => {
  it('front face drifts from plane 0 of the haze scene', () => {
    const drifted = (shape, o) =>
      H.front(shape, { ...o, corner: H.CORNER_R * 1.02 })
    expect(() => checkFrontIsPlane0(SET, drifted)).toThrow(
      /drifted from plane 0/,
    )
  })

  it('2 units of margin on the tight box', () => {
    const bad = { ...files }
    const vb = files['icon-account.svg']
      .match(/viewBox="([^"]+)"/)[1]
      .split(' ')
      .map(Number)
    bad['icon-account.svg'] = withViewBox(
      files['icon-account.svg'],
      `${vb[0].toFixed(3)} ${vb[1].toFixed(3)} ${(vb[2] + 2).toFixed(3)} ${vb[3].toFixed(3)}`,
    )
    expect(() => checkBoxes(SET, bad)).toThrow(/account tight/)
  })

  it('square ink jammed into the corner instead of centred', () => {
    const bad = { ...files }
    const side = files['icon-account-square.svg']
      .match(/viewBox="([^"]+)"/)[1]
      .split(' ')[2]
    bad['icon-account-square.svg'] = withViewBox(
      files['icon-account.svg'],
      `0.000 0.000 ${side} ${side}`,
    )
    expect(() => checkBoxes(SET, bad)).toThrow(
      /account square: ink not centred in the file/,
    )
  })

  it('square ink 0.01 units of 1000 off centre', () => {
    const off = (shape, o) => {
      const r = H.front(shape, o)
      if (o.square) r.ink[0] += 0.01
      return r
    }
    expect(() => checkBoxes(SET, files, off)).toThrow(
      /square: ink not centred \(/,
    )
  })

  it('serialiser writes a viewBox taller than front() computed', () => {
    const bad = { ...files }
    const vb = files['icon-account-square.svg']
      .match(/viewBox="([^"]+)"/)[1]
      .split(' ')
      .map(Number)
    bad['icon-account-square.svg'] = withViewBox(
      files['icon-account-square.svg'],
      `0.000 0.000 ${vb[2].toFixed(3)} ${(vb[3] + 1).toFixed(3)}`,
    )
    expect(() => checkBoxes(SET, bad)).toThrow(/file viewBox/)
  })

  it('colour baked back into the files', () => {
    const bad = {
      ...files,
      'icon-account-square.svg': files['icon-account-square.svg'].replace(
        'currentColor',
        '#141414',
      ),
    }
    expect(() => checkColour(bad)).toThrow(/colour FAILED/)
  })

  it("an icon that ignores the set's stroke weight", () => {
    const deaf = { ...SET, settings: [() => settings(BAR), {}] }
    expect(() => checkBarIsLive(deaf)).toThrow(/BAR is not live for: settings/)
  })

  it('two icon names for one picture', () => {
    const dup = { ...SET, 'arrow-left-camright': [arrowLeft, {}] }
    const rendered = renderSet(dup)
    expect(() => checkNoDuplicates(dup, rendered)).toThrow(
      /arrow-left, arrow-left-camright/,
    )
  })
})
