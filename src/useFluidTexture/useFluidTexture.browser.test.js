import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { findBrowser, openPage } from '../test/browser.js'

// The simulation's output, as pixels, in a real Canvas on the WebGPU renderer,
// which takes its WebGL 2 backend under headless Chromium's SwiftShader. The
// output pass paints white where the fluid is still and darker where it
// moves, so grey level is the instrument. These are the tests the test
// renderer cannot run; src/test/browser.js is the harness.
//
// The numbers in the comments were measured on 2026-10-06 on Linux, Chromium
// 154 under SwiftShader, after the port to TSL. They differ from the WebGL
// version's because the force now accumulates: the old hook cleared the
// advected velocity before adding the force (docs/useFluidTexture.md, Notes).

const browser = findBrowser()
const ENTRY = resolve(import.meta.dirname, 'useFluidTexture.browser-entry.jsx')

/** Mean grey of a rectangle, x0..x1 by y0..y1 in fractions of the image; row 0 is the top. */
function region({ width, height, grey }, x0, y0, x1, y1) {
  let sum = 0
  let n = 0
  for (let y = Math.floor(y0 * height); y < Math.ceil(y1 * height); y++)
    for (let x = Math.floor(x0 * width); x < Math.ceil(x1 * width); x++) {
      sum += grey[y * width + x]
      n++
    }
  return sum / n
}

/** The warm-up steps run in the frame loop after the page is ready; wait them out before stepping by hand. */
const settle = () => new Promise((r) => setTimeout(r, 500))

describe.skipIf(!browser)('useFluidTexture in the browser', () => {
  let site
  beforeAll(async () => {
    site = await openPage(ENTRY, { width: 96, height: 96 })
  }, 120_000)
  afterAll(async () => site && (await site.close()))

  it('mounts and draws a still field white, with no page errors or warnings', async () => {
    const img = await site.evaluate(() => window.__fluid.read())
    expect(img.width).toBe(96)
    expect(region(img, 0, 0, 1, 1)).toBeGreaterThan(250)
    expect(site.errors).toEqual([])
    expect(site.warnings).toEqual([])
  }, 60_000)

  it('a force at the centre sets the fluid moving there and not at the corners', async () => {
    await site.reload(() => {
      window.__force = { x: 0.3, y: 0 }
      window.__center = { x: 0, y: 0 }
      window.__radius = 40
    })
    await settle()
    await site.evaluate(() => window.__fluid.step(20))
    const img = await site.evaluate(() => window.__fluid.read())
    const centre = region(img, 0.4, 0.4, 0.6, 0.6) // measured 19
    const corner = region(img, 0, 0, 0.12, 0.12) // measured 246
    expect(centre).toBeLessThan(corner - 100)
    expect(corner).toBeGreaterThan(230)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('with no force the field stays still through steps', async () => {
    await site.reload(() => {
      window.__force = { x: 0, y: 0 }
    })
    await settle()
    await site.evaluate(() => window.__fluid.step(30))
    const img = await site.evaluate(() => window.__fluid.read())
    expect(region(img, 0, 0, 1, 1)).toBeGreaterThan(250)
  }, 60_000)

  it('the flow persists after the force stops and decays: advection carries the field, viscosity or not', async () => {
    for (const isViscous of [true, false]) {
      await site.reload((v) => {
        window.__opts = { isViscous: v }
        window.__force = { x: 0.3, y: 0 }
        window.__center = { x: 0, y: 0 }
        window.__radius = 40
      }, isViscous)
      await settle()
      await site.evaluate(() => window.__fluid.step(20))
      await site.evaluate(() => {
        window.__force = { x: 0, y: 0 }
      })
      await site.evaluate(() => window.__fluid.step(10))
      let img = await site.evaluate(() => window.__fluid.read())
      const released = region(img, 0.4, 0.4, 0.6, 0.6) // measured 61 viscous, 36 not
      const corner = region(img, 0, 0, 0.12, 0.12) // measured 250, 243
      // ten steps after the force stopped the centre is still moving: the old hook lost this every frame
      expect(released).toBeLessThan(corner - 100)
      await site.evaluate(() => window.__fluid.step(30))
      img = await site.evaluate(() => window.__fluid.read())
      const later = region(img, 0.4, 0.4, 0.6, 0.6) // measured 145, 135
      // and it decays toward still without stopping dead
      expect(later).toBeGreaterThan(released + 40)
      expect(later).toBeLessThan(240)
    }
    expect(site.errors).toEqual([])
  }, 240_000)

  it('a force above the centre darkens the top of the picture: y is up, in every pass', async () => {
    // Every pass samples a render target at an explicit coordinate, which the renderer stores top row first;
    // a pass that forgot the flip would read its input mirrored and the blob would land at the bottom.
    await site.reload(() => {
      window.__opts = { isViscous: false }
      window.__force = { x: 0.3, y: 0 }
      window.__center = { x: 0, y: 0.5 }
      window.__radius = 40
    })
    await settle()
    await site.evaluate(() => window.__fluid.step(20))
    const img = await site.evaluate(() => window.__fluid.read())
    const top = region(img, 0.3, 0, 0.7, 0.4) // measured 83
    const bottom = region(img, 0.3, 0.6, 0.7, 1) // measured 192
    expect(top).toBeLessThan(bottom - 60)
  }, 60_000)

  it('the wall: with isBounce the normal flow beside it stops, without it the flow runs through the edge, and the rim is never in the picture', async () => {
    // One texel per pixel. The output samples the interior, so column 0 is the first fluid cell, not the wall.
    const run = async (isBounce) => {
      await site.reload((b) => {
        window.__opts = { isBounce: b, fboWidth: 96, fboHeight: 96 }
        window.__force = { x: -0.3, y: 0 }
        window.__center = { x: -0.6, y: 0 }
        window.__radius = 40
      }, isBounce)
      await settle()
      await site.evaluate(() => window.__fluid.step(40))
      const img = await site.evaluate(() => window.__fluid.read())
      // fields.velocity drawn as its x component, mid grey (128) for zero: below 128 flows left, into the wall
      const vx = await site.evaluate(() => window.__fluid.readVelocity('x'))
      return {
        edge: region(img, 0, 0.35, 1 / img.width, 0.65),
        inside: region(img, 8 / img.width, 0.35, 0.2, 0.65),
        vxNear: region(vx, 1 / vx.width, 0.35, 2 / vx.width, 0.65),
      }
    }
    const bounce = await run(true)
    const open = await run(false)
    // Both runs moved the fluid toward the wall. Measured 65 and 87.
    expect(bounce.inside).toBeLessThan(240)
    expect(open.inside).toBeLessThan(240)
    // With the wall the normal velocity in the first fluid cell is near zero; without, the flow runs through. Measured 120 against 42.
    expect(Math.abs(bounce.vxNear - 128)).toBeLessThan(20)
    expect(open.vxNear).toBeLessThan(128 - 40)
    // The wall leaves less motion at the edge than the open run. Measured 91 against 61.
    expect(bounce.edge).toBeGreaterThan(open.edge + 15)
    // The rim is not shown: the first column is fluid under both settings, no white line.
    expect(bounce.edge).toBeLessThan(250)
    expect(open.edge).toBeLessThan(250)
    expect(site.errors).toEqual([])
  }, 240_000)
})
