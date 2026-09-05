import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CAM_OFF } from '../lib/haze.js'
import { HAZE_CUTS } from '../../src/utils/hazePlanes.js'
import { SIZES, gapFor } from './build.js'
import { lockup } from './lockup.js'
import {
  DEFAULT_COUNT,
  PARAMS,
  VIEWS,
  chosen,
  chosenSvg,
  parseArgs,
  run,
  sheet,
  sweep,
  variants,
} from './export.js'

describe('export:logo arguments', () => {
  it('reads a value, its own buffer and count, and the global fallbacks', () => {
    const o = parseArgs([
      '--off',
      '1.9:0.05:3',
      '--spacing',
      '1.2',
      '-b',
      '0.2',
      '-c',
      '1',
    ])
    expect(o.params.off).toEqual({ value: 1.9, buffer: 0.05, count: 3 })
    expect(o.params.spacing).toEqual({ value: 1.2 })
    expect(o.buffer).toBe(0.2)
    expect(o.count).toBe(1)
  })

  it('accepts --flag=value, and defaults the count', () => {
    const o = parseArgs([
      '--off=1.9',
      '--view=icon',
      '--cut=dense',
      '--reverse',
    ])
    expect(o.params.off.value).toBe(1.9)
    expect(o.view).toBe('icon')
    expect(o.cut).toBe('dense')
    expect(o.reverse).toBe(true)
    expect(o.count).toBe(DEFAULT_COUNT)
  })

  it('refuses what it cannot draw', () => {
    expect(() => parseArgs(['--bogus', '1'])).toThrow(/unknown argument/)
    expect(() => parseArgs(['--off', 'x'])).toThrow(/wants a number/)
    expect(() => parseArgs(['--off'])).toThrow(/wants a value/)
    expect(() => parseArgs(['--view', 'poster'])).toThrow(/unknown view/)
    expect(() => parseArgs(['--cut', 'fog'])).toThrow(/unknown cut/)
    expect(() => parseArgs(['-c', '1.5'])).toThrow(/whole number/)
    expect(() => parseArgs(['-b', '0'])).toThrow(/buffer must be/)
    expect(() => parseArgs(['--gap', '3', '--view', 'icon'])).toThrow(
      /lockup view only/,
    )
  })
})

describe('export:logo sweep', () => {
  it('is x - c·b ... x + c·b, the example from the brief', () => {
    expect(sweep('off', { value: 1.9, buffer: 0.1, count: 2 })).toEqual([
      1.7, 1.8, 1.9, 2.0, 2.1,
    ])
  })

  it('rounds and deduplicates integer parameters, and drops what the engine rejects', () => {
    expect(sweep('planes', { value: 4, buffer: 0.5, count: 2 })).toEqual([
      3, 4, 5,
    ])
    expect(sweep('planes', { value: 2, buffer: 1, count: 2 })).toEqual([
      1, 2, 3, 4,
    ])
    expect(sweep('spacing', { value: 0.1, buffer: 0.1, count: 2 })).toEqual([
      0.1, 0.2, 0.3,
    ])
    expect(sweep('haze', { value: 0.98, buffer: 0.02, count: 2 })).toEqual([
      0.94, 0.96, 0.98,
    ])
  })

  it('a count of 0 is the chosen value alone', () => {
    expect(sweep('off', { value: 1.9, buffer: 0.1, count: 0 })).toEqual([1.9])
  })
})

describe('export:logo values', () => {
  it('fills the scene defaults in, the haze from the cut, the gap left to derive', () => {
    const v = chosen(parseArgs(['--off', '1.9', '--cut', 'dense']))
    expect(v.off).toBe(1.9)
    expect(v.spacing).toBe(1)
    expect(v.dist).toBe(6)
    expect(v.planes).toBe(4)
    expect(v.haze).toBe(Number(HAZE_CUTS.dense.toFixed(10)))
    expect(v.size).toBe(1)
    expect(v.gap).toBeNull()
  })

  it('leaves the lockup parameters out of the icon view', () => {
    const v = chosen(parseArgs(['--view', 'icon']))
    expect('size' in v).toBe(false)
    expect('gap' in v).toBe(false)
  })

  it('sweeps one parameter at a time, marking the chosen row, per-parameter defaults applying', () => {
    const rows = variants(
      parseArgs(['--off', '1.9', '--planes', '4', '-c', '1']),
    )
    expect(rows.map((r) => r.label)).toEqual([
      'off 1.8',
      'off 1.9  (chosen)',
      'off 2',
      'planes 3',
      'planes 4  (chosen)',
      'planes 5',
    ])
    expect(rows[0].values.planes).toBe(4)
    expect(rows[5].values.off).toBe(1.9)
    expect(rows.filter((r) => r.chosen)).toHaveLength(2)
  })

  it('with nothing swept, the sheet is the chosen row alone', () => {
    expect(variants(parseArgs([]))).toHaveLength(1)
  })
})

describe('export:logo output', () => {
  it('the chosen file at the shipped scene is the shipped lockup, with the values in a comment', () => {
    const { svg, values } = chosenSvg(parseArgs([]))
    const want = readFileSync(
      new URL(
        './lockups/cocoon-lockup-icon1.00-air2x-vapour.svg',
        import.meta.url,
      ),
      'utf8',
    )
    expect(svg.split('\n').slice(2).join('\n')).toBe(
      want.split('\n').slice(1).join('\n'),
    )
    expect(svg).toMatch(
      /<!-- export:logo lockup vapour: off=1.9 .* gap=[\d.]+ .* wdth=107 -->/,
    )
    expect(values.off).toBe(CAM_OFF)
    expect(values.gap).toBe(gapFor(2))
  })

  it('air sets the derived gap; a given gap overrides it', () => {
    const at = (air) => chosenSvg(parseArgs(['--air', String(air)])).values.gap
    expect(at(1)).toBe(gapFor(1))
    expect(at(3)).toBe(gapFor(3))
    // a size past the shipped ones widens the gap; a smaller one does not narrow it
    expect(chosenSvg(parseArgs(['--size', '1.5'])).values.gap).toBe(
      gapFor(2, [...SIZES, 1.5]),
    )
    expect(chosenSvg(parseArgs(['--size', '0.5'])).values.gap).toBe(gapFor(2))
    expect(chosenSvg(parseArgs(['--air', '3', '--gap', '2'])).values.gap).toBe(
      2,
    )
  })

  it('the wordmark instance is recut per row, the shipped one unchanged', () => {
    const shipped = chosenSvg(parseArgs([])).svg
    const wide = chosenSvg(parseArgs(['--wdth', '112'])).svg
    const heavy = chosenSvg(parseArgs(['--wght', '400'])).svg
    expect(chosenSvg(parseArgs(['--wdth', '107', '--wght', '350'])).svg).toBe(
      shipped.replace(/ -->/, ' -->'),
    )
    expect(wide).not.toBe(shipped)
    expect(heavy).not.toBe(shipped)
    expect(sweep('wght', { value: 850, buffer: 50, count: 2 })).toEqual([
      750, 800, 850, 900,
    ])
    expect(sweep('wdth', { value: 120, buffer: 5, count: 2 })).toEqual([
      110, 115, 120, 125,
    ])
  })

  it('a chosen gap is used as given', () => {
    const { svg } = chosenSvg(parseArgs(['--gap', '3']))
    expect(svg.split('\n').slice(2).join('\n')).toBe(
      lockup({ size: 1, gapStems: 3, iconKw: { cut: 'vapour' } })
        .svg.split('\n')
        .slice(1)
        .join('\n'),
    )
  })

  it('the icon view at the shipped scene draws the shipped icon', () => {
    const { svg } = chosenSvg(
      parseArgs(['--view', 'icon', '--cut', 'dense', '--reverse']),
    )
    const shipped = readFileSync(
      new URL('./cocoon-icon-dense-reversed.svg', import.meta.url),
      'utf8',
    )
    expect(svg.split('\n').slice(2).join('\n')).toBe(
      shipped.split('\n').slice(1).join('\n'),
    )
  })

  it('the sheet holds one nested svg per variant per width, labelled, separated by parameter', () => {
    const o = parseArgs(['--off', '1.9', '--size', '1', '-c', '1'])
    const rows = variants(o)
    const { svg, width } = sheet(rows, o)
    const widths = VIEWS.lockup.widths
    expect(svg.match(/<svg x=/g)).toHaveLength(rows.length * widths.length)
    expect(svg.match(/<text /g)).toHaveLength(rows.length)
    expect(svg.match(/<line /g)).toHaveLength(1)
    expect(svg).toContain('off 1.9  (chosen)')
    expect(svg).toMatch(/gap [\d.]+ stems/)
    expect(width).toBe(
      40 + widths.reduce((a, w) => a + w, 0) + 30 * (widths.length - 1),
    )
  })

  it('surface and ground recolour every plane and the sheet', () => {
    expect(() => parseArgs(['--ground', 'blue'])).toThrow(/hex colour/)
    const o = parseArgs([
      '--view',
      'icon',
      '--surface',
      '#0a0a3c',
      '--ground',
      'fff',
    ])
    expect(o.surface).toBe('#0A0A3C')
    expect(o.ground).toBe('#FFFFFF')
    const { svg } = chosenSvg(o)
    expect(svg).toContain('fill="#0A0A3C"')
    expect(svg).not.toContain('fill="#141414"')
    expect(svg).toContain('surface=#0A0A3C ground=#FFFFFF:')
    const sh = sheet(variants(o), o).svg
    expect(sh).toContain('fill="#FFFFFF"/>')
    // reversed: the surface becomes the ground of the sheet
    const r = parseArgs(['--view', 'icon', '--surface', '#0A0A3C', '--reverse'])
    expect(sheet(variants(r), r).svg).toContain('fill="#0A0A3C"/>')
  })

  it('a reversed sheet stands on ink', () => {
    const o = parseArgs(['--reverse', '--cut', 'dense'])
    expect(sheet(variants(o), o).svg).toContain('fill="#141414"/>')
  })

  it('run writes the three files', () => {
    const out = mkdtempSync(join(tmpdir(), 'export-logo-'))
    try {
      const { paths } = run(
        parseArgs(['--off', '1.9', '-c', '0', '--out', out, '--name', 't']),
      )
      expect(readFileSync(paths.chosen, 'utf8')).toContain('export:logo')
      expect(readFileSync(paths.examples, 'utf8')).toContain(
        'off 1.9  (chosen)',
      )
      expect(readFileSync(paths.examplesPng).subarray(1, 4).toString()).toBe(
        'PNG',
      )
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it('every parameter has a positive default buffer and a documented range', () => {
    for (const p of Object.values(PARAMS)) {
      expect(p.buffer).toBeGreaterThan(0)
      expect(typeof p.doc).toBe('string')
      expect(typeof p.valid).toBe('function')
    }
  })
})
