import { describe, expect, it } from 'vitest'
import {
  HAZE_CUTS,
  HAZE_DEFAULTS,
  hazeAnalyse,
  hazeMaxSpacing,
  hazeResolve,
  hazeShadow,
  hazeTones,
} from './hazePlanes.js'

// The four house cuts, as the logo spec tables them (k = 0 .. 3).
const RAMPS = {
  vapour: ['#141414', '#C8C8C8', '#EAEAEA', '#F6F6F6'],
  'vapour reversed': ['#FFFFFF', '#AFAFAF', '#777777', '#515151'],
  dense: ['#141414', '#C9C9C9', '#E0E0E0', '#E6E6E6'],
  'dense reversed': ['#E8E8E8', '#858585', '#4B4B4B', '#2C2C2C'],
}
const CUT_OPTS = {
  vapour: { cut: 'vapour', surface: '#141414', ground: '#FFFFFF' },
  'vapour reversed': { cut: 'vapour', surface: '#FFFFFF', ground: '#141414' },
  dense: { cut: 'dense', surface: '#141414', ground: '#E8E8E8' },
  'dense reversed': { cut: 'dense', surface: '#E8E8E8', ground: '#141414' },
}

describe('hazeTones', () => {
  for (const [name, ramp] of Object.entries(RAMPS)) {
    it(`reproduces the ${name} ramp from the logo spec`, () => {
      expect(hazeTones(CUT_OPTS[name])).toEqual(ramp)
    })
  }

  it('accepts 3-digit hex and rejects anything else', () => {
    expect(hazeTones({ surface: '#fff', ground: '#000' })).toEqual(
      hazeTones({ surface: '#FFFFFF', ground: '#000000' }),
    )
    expect(() => hazeTones({ surface: 'red' })).toThrow(/bad colour/)
  })
})

describe('hazeResolve', () => {
  it('fills defaults, and height defaults to width', () => {
    const o = hazeResolve({ width: 100 })
    expect(o.height).toBe(100)
    expect(o.planes).toBe(HAZE_DEFAULTS.planes)
    expect(o.haze).toBe(HAZE_CUTS.vapour)
  })

  it('sets haze by cut name', () => {
    expect(hazeResolve({ cut: 'dense' }).haze).toBe(HAZE_CUTS.dense)
    expect(() => hazeResolve({ cut: 'fog' })).toThrow(/unknown cut/)
  })

  it('rejects an impossible scene', () => {
    expect(() => hazeResolve({ width: 0 })).toThrow(/width/)
    expect(() => hazeResolve({ planes: 1 })).toThrow(/planes/)
    expect(() => hazeResolve({ spacing: 0 })).toThrow(/spacing/)
    expect(() => hazeResolve({ distance: -1 })).toThrow(/distance/)
    expect(() => hazeResolve({ haze: 1 })).toThrow(/haze/)
  })
})

describe('hazeAnalyse', () => {
  const W = 48
  const a = hazeAnalyse({ width: W })

  it('projects the house scene to 6/7 : 3/4 : 2/3', () => {
    expect(a.planes.map((p) => p.scale)).toEqual([6 / 7, 3 / 4, 2 / 3])
  })

  it('derives spreads -W/14, -W/8, -W/6 and offsets 13W/70, 13W/40, 13W/30', () => {
    const spreads = a.planes.map((p) => p.spread)
    const offsets = a.planes.map((p) => p.offset)
    ;[-W / 14, -W / 8, -W / 6].forEach((v, i) =>
      expect(spreads[i]).toBeCloseTo(v, 10),
    )
    ;[(13 * W) / 70, (13 * W) / 40, (13 * W) / 30].forEach((v, i) =>
      expect(offsets[i]).toBeCloseTo(v, 10),
    )
  })

  it('is exact on a square with sharp corners', () => {
    expect(a.worstError).toBe(0)
    expect(a.ok).toBe(true)
    expect(a.hidden).toEqual([])
  })

  it('reports the height error (1 - S)|W - H| off square', () => {
    const b = hazeAnalyse({ width: 240, height: 120 })
    b.planes.forEach((p) =>
      expect(p.heightError).toBeCloseTo((1 - p.scale) * 120, 10),
    )
    expect(b.ok).toBe(false)
  })

  it('is exact at radius 0 and radius W/2, and not between', () => {
    expect(hazeAnalyse({ width: 240, radius: 0 }).worstError).toBe(0)
    expect(hazeAnalyse({ width: 240, radius: 120 }).worstError).toBeCloseTo(
      0,
      10,
    )
    expect(hazeAnalyse({ width: 240, radius: 40 }).worstError).toBeGreaterThan(
      1,
    )
  })

  it('hides every plane at cameraX 0.5', () => {
    const c = hazeAnalyse({ cameraX: 0.5 })
    expect(c.hidden).toEqual([1, 2, 3])
    expect(c.ok).toBe(false)
  })

  it('carries the tones for the scene', () => {
    expect(a.tones).toEqual(RAMPS.vapour)
  })
})

describe('hazeMaxSpacing', () => {
  it('returns the given spacing when the geometry is already clean', () => {
    expect(hazeMaxSpacing({ width: 48 })).toBe(1)
  })

  it('finds the widest spacing inside the budget otherwise', () => {
    const opts = { width: 240, radius: 40 }
    const s = hazeMaxSpacing(opts, 1)
    expect(s).toBeLessThan(1)
    expect(hazeAnalyse({ ...opts, spacing: s }).worstError).toBeLessThanOrEqual(
      1,
    )
    expect(
      hazeAnalyse({ ...opts, spacing: s * 1.05 }).worstError,
    ).toBeGreaterThan(1)
  })
})

describe('hazeShadow', () => {
  it('emits box-shadow with planes - 1 layers on a clean square', () => {
    const css = hazeShadow({ width: 48, comment: false })
    expect(css.startsWith('.haze {')).toBe(true)
    expect(css).toContain('background: #141414;')
    expect(css.match(/#[0-9A-F]{6}/g)).toHaveLength(4)
    expect(css).toMatch(/8\.9143px 0 0 -3\.4286px #C8C8C8/)
  })

  it('falls back to the transform stack off square under auto', () => {
    const css = hazeShadow({ width: 240, height: 120, comment: false })
    expect(css).toContain('transform-origin: 180% 50%')
    expect(css.match(/transform: scale\(/g)).toHaveLength(3)
    expect(css).toContain('.haze-content')
  })

  it('honours an explicit technique and rejects an unknown one', () => {
    expect(hazeShadow({ technique: 'transform', comment: false })).toContain(
      'transform: scale(0.857143)',
    )
    expect(() => hazeShadow({ technique: 'blur' })).toThrow(/unknown technique/)
  })

  it('emits calc() lengths against --haze-w when responsive', () => {
    const css = hazeShadow({ responsive: true, comment: false })
    expect(css).toContain('--haze-w: 48px;')
    expect(css).toContain('calc(var(--haze-w) * 0.185714)')
  })

  it('describes the scene in the header comment', () => {
    const css = hazeShadow({ width: 240, height: 120 })
    expect(css).toMatch(/^\/\* hazePlanes - transform/)
    expect(css).toContain('4 planes, spacing 1w, distance 6w, cameraX 1.3w')
    expect(css).toContain('ramp   #141414 -> #C8C8C8 -> #EAEAEA -> #F6F6F6')
  })
})
