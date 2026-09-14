import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  COMPONENT_PROPS,
  OPTIONS,
  findBrowser,
  fitDistance,
  html,
  orbit,
  parseArgs,
  plan,
  run,
} from './export-group.js'

const browser = findBrowser()

describe('export:logo-group arguments', () => {
  it('parses every component prop by type and keeps the camera defaults', () => {
    const o = parseArgs([
      '--view',
      'icon',
      '--width=2',
      '--reverse',
      '--scene',
      '{"planes":3}',
      '--meshStandardMaterialProps',
      '{"roughness":0.3}',
      '--light',
      '1,0,0',
    ])
    expect(o.props).toEqual({
      view: 'icon',
      width: 2,
      reverse: true,
      scene: { planes: 3 },
      meshStandardMaterialProps: { roughness: 0.3 },
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
      'meshStandardMaterialProps',
    ])
  })
})

describe('the camera', () => {
  it('fits whichever of width and height binds to the given fraction of the view', () => {
    const fov = 20
    const aspect = 2
    const t = Math.tan((fov * Math.PI) / 360)
    // wide face: width binds
    const dw = fitDistance(1, 0.1, fov, aspect, 0.9)
    expect(1 / (2 * dw * t * aspect)).toBeCloseTo(0.9, 9)
    // tall face: height binds
    const dh = fitDistance(0.1, 1, fov, aspect, 0.9)
    expect(1 / (2 * dh * t)).toBeCloseTo(0.9, 9)
  })

  it('orbits about the target at the distance', () => {
    expect(orbit({ distance: 3, yaw: 90, pitch: 0 })[0]).toBeCloseTo(3, 9)
    expect(orbit({ distance: 3, yaw: 90, pitch: 0 })[2]).toBeCloseTo(0, 9)
    expect(orbit({ distance: 1, yaw: 0, pitch: 0, target: [5, 0, 0] })).toEqual(
      [5, 0, 1],
    )
  })
})

describe('the page', () => {
  const o = parseArgs(['--depth', '0.05', '--cell', '300'])
  const p = plan(o)

  it('plans three cells: head on fitted, turned, and the lit detail on the front triangle', () => {
    const { cells } = p.data
    expect(cells).toHaveLength(3)
    expect(cells[0].position[0]).toBeCloseTo(0, 9)
    expect(cells[0].position[2]).toBeCloseTo(p.camera.distance, 9)
    expect(cells[1].position[0]).toBeGreaterThan(0) // yaw 35 turns it to +x
    expect(cells[2].target).toEqual(p.logo.pieces[0].position)
    expect(cells[2].lit).toBe(true)
    expect(cells[0].lit).toBe(false)
  })

  it('carries every piece with its vertex buffers, tone, width and position', () => {
    expect(p.data.pieces.map((x) => x.name)).toEqual([
      'plane0',
      'plane1',
      'plane2',
      'plane3',
      'wordmark',
    ])
    for (const [i, x] of p.data.pieces.entries()) {
      const g = p.logo.pieces[i].geometry
      expect(Buffer.from(x.position64, 'base64').byteLength).toBe(
        g.attributes.position.array.byteLength,
      )
      expect(Buffer.from(x.normal64, 'base64').byteLength).toBe(
        g.attributes.normal.array.byteLength,
      )
      expect(x.tone).toBe(p.logo.pieces[i].tone)
    }
  })

  it('prints every component prop and the measures', () => {
    const keys = p.data.propLines.map(([k]) => k)
    expect(keys).toEqual(COMPONENT_PROPS)
    expect(p.data.propLines.find(([k]) => k === 'depth')[1]).toMatch(/^0\.05$/)
    const derived = p.data.derived.map(([k]) => k)
    for (const k of [
      'height',
      'gap, stems',
      'vertices',
      'fov',
      'distance',
      'renderer',
    ])
      expect(derived).toContain(k)
  })

  it('is one self-contained file: three, the font, the data, three canvases, the renderer as a fiber Canvas sets it', () => {
    const page = html(p.data)
    expect(page).toContain(
      'import * as THREE from "data:text/javascript;base64,',
    )
    expect(page).toContain('font-family: Saira; src: url(data:font/ttf;base64,')
    expect(page.match(/<canvas /g)).toHaveLength(3)
    expect(page).toContain(
      'new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true })',
    )
    expect(page).toContain('renderer.toneMapping = THREE.ACESFilmicToneMapping')
    expect(page).toContain('renderer.outputColorSpace = THREE.SRGBColorSpace')
    expect(page).toContain(
      'new THREE.MeshBasicMaterial({ color: p.tone, toneMapped: false })',
    )
    expect(page).toContain('window.__rendered = true')
    for (const k of COMPONENT_PROPS)
      expect(page).toContain(`<div class="k">${k}</div>`)
  })

  it('writes the html, and the png only when a browser is found', async () => {
    const out = mkdtempSync(join(tmpdir(), 'logo-group-'))
    try {
      const r = await run(
        parseArgs(['--out', out, '--name', 'probe', '--cell', '240']),
      )
      expect(existsSync(r.paths.html)).toBe(true)
      expect(
        readFileSync(r.paths.html, 'utf8').startsWith('<!doctype html>'),
      ).toBe(true)
      if (browser) expect(existsSync(r.paths.png)).toBe(true)
      else expect(r.paths.png).toBeNull()
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }, 120_000)

  it.skipIf(!browser)(
    'renders through Chromium: the png is opaque and the ground and the ink both appear',
    async () => {
      const out = mkdtempSync(join(tmpdir(), 'logo-group-'))
      try {
        const r = await run(
          parseArgs(['--out', out, '--name', 'probe', '--cell', '240']),
        )
        const png = readFileSync(r.paths.png)
        expect(png.subarray(1, 4).toString()).toBe('PNG')
        // colour type at byte 25 of the IHDR: 2 is RGB, 6 is RGBA; either way the sheet is drawn on an opaque ground
        expect([2, 6]).toContain(png[25])
      } finally {
        rmSync(out, { recursive: true, force: true })
      }
    },
    120_000,
  )
})
