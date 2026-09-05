import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { grey, pixelDiff, rasterize } from '../lib/raster.js'
import * as H from '../lib/haze.js'
import * as M from './mark.js'
import * as W from './wordmark.js'
import { FONT, lockup, wordmark } from './lockup.js'
import {
  AIR_TIERS,
  SIZES,
  checkLockups,
  checkSpec,
  gapFor,
  render,
  trailWorst,
} from './build.js'

const here = dirname(fileURLToPath(import.meta.url))
const files = render()

describe('the shipped files', () => {
  it('are exactly what the build emits (rebuild before committing a scene change)', () => {
    const shipped = [
      ...readdirSync(here).filter((f) => f.endsWith('.svg')),
      ...readdirSync(join(here, 'lockups')).map((f) => `lockups/${f}`),
    ]
    expect(shipped.sort()).toEqual(Object.keys(files).sort())
    for (const f of shipped)
      expect(readFileSync(join(here, f), 'utf8'), f).toBe(files[f])
  })
})

describe('the mark', () => {
  it('is 48 degrees at the sharp vertex with equal top and right sides', () => {
    const [[tr, tl, apex]] = M.triangle()
    const top = Math.hypot(tr[0] - tl[0], tr[1] - tl[1])
    const right = Math.hypot(tr[0] - apex[0], tr[1] - apex[1])
    expect(top).toBeCloseTo(1000, 9)
    expect(right).toBeCloseTo(1000, 9)
    const base = Math.hypot(tl[0] - apex[0], tl[1] - apex[1])
    expect(base).toBeCloseTo(2 * 1000 * Math.sin((24 * Math.PI) / 180), 9)
  })

  it('carries the four house ramps from the spec', () => {
    expect(M.build().pieces.map((p) => p.fill)).toEqual([
      '#141414',
      '#C8C8C8',
      '#EAEAEA',
      '#F6F6F6',
    ])
    expect(
      M.build({ cut: 'dense', reverse: true }).pieces.map((p) => p.fill),
    ).toEqual(['#E8E8E8', '#858585', '#4B4B4B', '#2C2C2C'])
  })

  it('is the icon engine drawing a triangle, so the icon set cannot drift from it', () => {
    const { pieces, bounds } = H.build(M.triangle(), { cut: 'vapour' })
    expect(H.svg(pieces, bounds)).toBe(files['cocoon-icon-vapour.svg'])
  })

  it('refuses a favicon whose ink crowds the tile', () => {
    expect(() => M.favicon(M.FAVI_LIGHT, { cut: 'dense', fill: 0.9 })).toThrow(
      /clears only/,
    )
  })
})

describe('the lockup rule', () => {
  it('derives the tier gaps from the worst trail, rounded up to the quarter stem', () => {
    const t = trailWorst()
    for (const air of AIR_TIERS)
      expect(gapFor(air)).toBe(Math.ceil((air + t) * 4) / 4)
  })

  it('delivers at least its stated clear air at every icon size', () => {
    const worst = checkLockups()
    for (const air of AIR_TIERS) expect(worst[air]).toBeGreaterThanOrEqual(air)
  })

  it('fails a tier whose gap was picked by hand instead of derived', () => {
    // 3.00 stems was the rejected candidate in the spec: it collides at 1.10x.
    expect(() => checkLockups(SIZES, [1], () => 3)).toThrow(/lockup air FAILED/)
  })

  it('agrees with the tier table in the spec', () => {
    expect(checkSpec()).toEqual({ 1: gapFor(1), 2: gapFor(2), 3: gapFor(3) })
  })

  it('paints the wordmark in plane 0 tone of the cut', () => {
    const { svg } = lockup({
      size: 1,
      gapStems: gapFor(2),
      reverse: true,
      iconKw: { cut: 'dense' },
    })
    expect(svg).toContain('fill="#E8E8E8" fill-rule="nonzero"')
  })
})

describe('the wordmark', () => {
  it('derives the mark from the instanced o as the spec states', () => {
    const { meta } = W.buildWordmark(FONT, 350, 107)
    expect(meta.sv).toBeCloseTo(71.1, 1)
    expect(meta.sh).toBeCloseTo(60.3, 1)
    expect(meta.a).toBeCloseTo(194.5, 1)
    expect(meta.b).toBeCloseTo(232.8, 1)
    expect(meta.markW).toBeCloseTo(961.9, 1)
  })

  it('reproduces the fontTools cut: same viewBox, under 0.05% of pixels differing at 1800 px', () => {
    const mine = W.svg(wordmark().pieces)
    const theirs = readFileSync(
      join(here, 'fixtures', 'cocoon-wordmark.fonttools.svg'),
      'utf8',
    )
    expect(mine.match(/viewBox="[^"]+"/)[0]).toBe(
      theirs.match(/viewBox="[^"]+"/)[0],
    )
    const d = pixelDiff(
      grey(rasterize(mine, { width: 1800 })),
      grey(rasterize(theirs, { width: 1800 })),
    )
    expect(d.fraction).toBeLessThan(0.0005)
  })
})
