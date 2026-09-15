import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { findBrowser, openPage } from '../test/browser.js'

// The simulation's output, as pixels, in a real Canvas through Chromium's
// software WebGL 2. The output pass paints white where the fluid is still
// and darker where it moves, so grey level is the instrument. These are the
// tests the test renderer cannot run; src/test/browser.js is the harness.

const browser = findBrowser()
const ENTRY = resolve(import.meta.dirname, 'useFluidTexture.browser-entry.jsx')

/** Mean grey of a rectangle, x0..x1 by y0..y1 in fractions of the image. */
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

describe.skipIf(!browser)('useFluidTexture in the browser', () => {
  let site
  beforeAll(async () => {
    site = await openPage(ENTRY, { width: 96, height: 96 })
  }, 120_000)
  afterAll(async () => site && (await site.close()))

  it('mounts and draws a still field white, with no page errors', async () => {
    const img = await site.evaluate(() => window.__fluid.read())
    expect(img.width).toBe(96)
    expect(region(img, 0, 0, 1, 1)).toBeGreaterThan(250)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('a force at the centre sets the fluid moving there and not at the corners', async () => {
    await site.reload(() => {
      window.__force = { x: 2, y: 0 }
      window.__center = { x: 0, y: 0 }
      window.__radius = 40
    })
    await site.evaluate(() => window.__fluid.step(20))
    const img = await site.evaluate(() => window.__fluid.read())
    const centre = region(img, 0.4, 0.4, 0.6, 0.6) // measured 204 at these settings
    const corner = region(img, 0, 0, 0.12, 0.12) // measured 253
    expect(centre).toBeLessThan(corner - 30)
    expect(corner).toBeGreaterThan(245)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('with no force the field stays still through steps', async () => {
    await site.reload(() => {
      window.__force = { x: 0, y: 0 }
    })
    await site.evaluate(() => window.__fluid.step(30))
    const img = await site.evaluate(() => window.__fluid.read())
    expect(region(img, 0, 0, 1, 1)).toBeGreaterThan(250)
  }, 60_000)

  it('the wall: with isBounce the flow beside the wall is slowed, without it the flow runs to the edge, and the rim is never in the picture', async () => {
    // One texel per pixel. The output samples the interior, so column 0 is the first fluid cell, not the wall.
    const run = async (isBounce) => {
      await site.reload((b) => {
        window.__opts = { isBounce: b, fboWidth: 96, fboHeight: 96 }
        window.__force = { x: -5, y: 0 }
        window.__center = { x: -0.6, y: 0 }
        window.__radius = 40
      }, isBounce)
      await site.evaluate(() => window.__fluid.step(40))
      const img = await site.evaluate(() => window.__fluid.read())
      return {
        edge: region(img, 0, 0.35, 1 / img.width, 0.65),
        near: region(img, 1 / img.width, 0.35, 4 / img.width, 0.65),
        inside: region(img, 8 / img.width, 0.35, 0.2, 0.65),
      }
    }
    const bounce = await run(true)
    const open = await run(false)
    // Both runs moved the fluid toward the wall.
    expect(bounce.inside).toBeLessThan(240)
    expect(open.inside).toBeLessThan(240)
    // The wall slows the flow beside it; open lets it run to the edge. Measured 205 against 187.
    expect(bounce.near).toBeGreaterThan(open.near + 10)
    // The rim is not shown: the first column is fluid under both settings, no white line. Measured 211 and 190.
    expect(bounce.edge).toBeLessThan(250)
    expect(open.edge).toBeLessThan(250)
  }, 120_000)

  it('the wall reverses the flow beside it: the normal velocity in the first fluid cell changes sign', async () => {
    // fields.velocity drawn as its x component, mid grey for zero: above 128 flows right, away from the left wall.
    const vx = async (isBounce) => {
      await site.reload((b) => {
        window.__opts = { isBounce: b, fboWidth: 96, fboHeight: 96 }
        window.__force = { x: -5, y: 0 }
        window.__center = { x: -0.6, y: 0 }
        window.__radius = 40
      }, isBounce)
      await site.evaluate(() => window.__fluid.step(40))
      const img = await site.evaluate(() => window.__fluid.readVelocityX())
      return region(img, 1 / img.width, 0.35, 2 / img.width, 0.65)
    }
    const bounce = await vx(true)
    const open = await vx(false)
    // Measured 180 with the wall, 100 without: the wall turns the flow around, the open edge lets it through.
    expect(bounce).toBeGreaterThan(128 + 20)
    expect(open).toBeLessThan(128 - 20)
    expect(site.errors).toEqual([])
  }, 120_000)
})
