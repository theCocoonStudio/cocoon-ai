import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildLogo } from '../../src/CocoonLogoGroup/build.js'
import {
  COMPONENT_PROPS,
  OPTIONS,
  camera,
  fitDistance,
  parseArgs,
  project,
  run,
  shade,
  sheet,
} from './export-group.js'

describe('export:logo-group arguments', () => {
  it('parses every component prop by type and keeps the camera defaults', () => {
    const o = parseArgs([
      '--view',
      'icon',
      '--width=2',
      '--reverse',
      '--scene',
      '{"planes":3}',
      '--light',
      '1,0,0',
    ])
    expect(o.props).toEqual({
      view: 'icon',
      width: 2,
      reverse: true,
      scene: { planes: 3 },
    })
    expect(o.light).toEqual([1, 0, 0])
    expect(o.fov).toBe(OPTIONS.fov.value)
    expect(o.yaw).toBe(OPTIONS.yaw.value)
  })

  it('refuses an unknown option, a bad number, bad JSON and a bad vector', () => {
    expect(() => parseArgs(['--radius', '1'])).toThrow(/unknown option/)
    expect(() => parseArgs(['--width', 'wide'])).toThrow(/not a number/)
    expect(() => parseArgs(['--scene', '{planes}'])).toThrow(/not JSON/)
    expect(() => parseArgs(['--light', '1,2'])).toThrow(/x,y,z/)
  })

  it('lists exactly the component props first', () => {
    expect(COMPONENT_PROPS).toEqual([
      'view',
      'width',
      'depth',
      'maxSize',
      'eps',
      'scene',
      'cut',
      'haze',
      'reverse',
      'surface',
      'ground',
      'size',
      'air',
      'gap',
      'extrudeOptions',
    ])
  })
})

describe('the camera', () => {
  it('fits the ink width to the given fraction of the view', () => {
    const fov = 20
    const aspect = 2
    const d = fitDistance(1, fov, aspect, 0.8)
    const halfView = d * Math.tan((fov * Math.PI) / 360) * aspect
    expect(1 / (2 * halfView)).toBeCloseTo(0.8, 9)
  })

  it('sits at the distance on the sphere and looks at the target', () => {
    const cam = camera({ fov: 20, distance: 3, yaw: 90, pitch: 0 }, 2)
    expect(cam.position.x).toBeCloseTo(3, 9)
    expect(cam.position.z).toBeCloseTo(0, 9)
    const t = camera(
      { fov: 20, distance: 1, yaw: 0, pitch: 0, target: [5, 0, 0] },
      2,
    )
    expect(t.position.toArray()).toEqual([5, 0, 1])
  })

  it('shades in linear light: full light keeps the tone, half light darkens it', () => {
    expect(shade('#C2C2C2', 1)).toBe('#C2C2C2')
    const half = shade('#C2C2C2', 0.5)
    expect(half < '#C2C2C2').toBe(true)
    expect(half).not.toBe('#616161') // not a gamma-space halving
  })
})

describe('the drawing', () => {
  it('projects only the faces that look at the camera: head on, the caps and the bevels, never the back', () => {
    const logo = buildLogo({ view: 'icon' })
    const cam = camera({ fov: 20, distance: 3, yaw: 0, pitch: 0 }, 2)
    const { count, polygons } = project(logo, cam, 200, 100, {
      light: [0, 0, 1],
      ambient: 0.5,
    })
    const all = logo.pieces.reduce(
      (a, p) => a + p.geometry.attributes.position.count / 3,
      0,
    )
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(all / 2)
    expect(polygons).toContain('<polygon')
  })

  it('prints every component prop and the measures on the sheet', () => {
    const s = sheet(parseArgs(['--depth', '0.05', '--cell', '300']))
    for (const k of COMPONENT_PROPS) expect(s.svg).toContain(`>${k}<`)
    for (const k of ['height', 'gap, stems', 'vertices', 'fov', 'distance'])
      expect(s.svg).toContain(`>${k}<`)
    expect(s.svg).toContain('0.05')
    expect(s.svg.match(/<svg x=/g)).toHaveLength(3) // three cells
  })

  it('writes the svg and png, and names the files', () => {
    const out = mkdtempSync(join(tmpdir(), 'logo-group-'))
    try {
      const r = run(
        parseArgs(['--out', out, '--name', 'probe', '--cell', '240']),
      )
      expect(existsSync(r.paths.svg)).toBe(true)
      expect(existsSync(r.paths.png)).toBe(true)
      expect(r.paths.png.endsWith('probe.png')).toBe(true)
      expect(readFileSync(r.paths.png).subarray(1, 4).toString()).toBe('PNG')
      expect(r.camera.distance).toBeGreaterThan(0)
      expect(r.back).toBeLessThan(1)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
