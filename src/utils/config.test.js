import { describe, expect, it } from 'vitest'
import { config } from '../../cocoon.config.js'
import { HAZE_CUTS, HAZE_DEFAULTS } from './hazePlanes.js'
import { buildLogo } from '../CocoonLogoGroup/build.js'
import * as H from '../../assets/lib/haze.js'
import { APEX_DEG, FAVI_MARGIN } from '../../assets/logo/mark.js'
import { WORD_WDTH, WORD_WGHT } from '../../assets/logo/lockup.js'
import { AIR_TIERS, SIZES, SQUARE_PAD } from '../../assets/logo/build.js'
import { DEFAULT_AIR, PARAMS } from '../../assets/logo/export.js'
import { OPTIONS } from '../../assets/logo/export-group.js'
import { BAR } from '../../assets/icons/shapes.js'

// cocoon.config.js is the one place a design default is stated. Each reader
// below is checked to take its value from there, so a change to the config
// reaches every output and no file restates a number.
describe('cocoon.config.js is the source of every default', () => {
  it('the scene module', () => {
    for (const k of ['planes', 'depth', 'radius', 'angle', 'perspective'])
      expect(HAZE_DEFAULTS[k]).toBe(config.scene[k])
    expect(HAZE_DEFAULTS.surface).toBe(config.ink)
    expect(HAZE_DEFAULTS.ground).toBe(config.cuts[config.cut].ground)
    expect(HAZE_DEFAULTS.haze).toBe(config.cuts[config.cut].haze)
    expect(HAZE_CUTS).toEqual({
      vapour: config.cuts.vapour.haze,
      dense: config.cuts.dense.haze,
    })
  })

  it('the haze engine, the mark, the favicon, the wordmark and the icons', () => {
    expect(H.CORNER_R).toBe(config.mark.corner)
    expect(H.INK).toBe(config.ink)
    expect(H.CUT_GROUND).toEqual({
      vapour: config.cuts.vapour.ground,
      dense: config.cuts.dense.ground,
    })
    expect(APEX_DEG).toBe(config.mark.apex)
    expect(FAVI_MARGIN).toBe(config.favicon.margin)
    expect([WORD_WGHT, WORD_WDTH]).toEqual([
      config.wordmark.wght,
      config.wordmark.wdth,
    ])
    expect(BAR).toBe(config.icons.bar * 1000)
  })

  it('the lockup family and the export defaults', () => {
    expect(SIZES).toBe(config.lockup.sizes)
    expect(AIR_TIERS).toBe(config.lockup.airTiers)
    expect(SQUARE_PAD).toBe(config.mark.squarePad)
    expect(DEFAULT_AIR).toBe(config.lockup.air)
    expect(PARAMS.size.value).toBe(config.lockup.size)
    for (const k of ['fov', 'fill', 'yaw', 'pitch', 'light', 'ambient', 'cell'])
      expect(OPTIONS[k].value).toBe(config.logoGroupExport[k])
  })

  it('the logo mesh', () => {
    const { options, depth, height, pieces } = buildLogo()
    expect(options.width).toBe(config.logoGroup.width)
    expect(options.maxSize).toBe(config.logoGroup.maxSize)
    expect(options.eps).toBe(config.logoGroup.eps)
    expect(options.cut).toBe(config.cut)
    expect(options.size).toBe(config.lockup.size)
    expect(options.air).toBe(config.lockup.air)
    expect(depth).toBeCloseTo(height * config.logoGroup.depthRatio, 12)
    const dt = depth / config.scene.planes
    expect(pieces[0].extrude.bevelSize * pieces[0].width).toBeCloseTo(
      config.logoGroup.bevelRatio * dt,
      12,
    )
    expect(pieces[0].extrude.bevelSegments).toBe(config.logoGroup.bevelSegments)
  })
})
