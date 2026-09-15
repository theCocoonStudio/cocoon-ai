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

  it('the wall instrument: pushing toward the left wall, isBounce changes what happens at the rim', async () => {
    const run = async (isBounce) => {
      await site.reload((b) => {
        window.__opts = { isBounce: b }
        window.__force = { x: -2, y: 0 }
        window.__center = { x: -0.6, y: 0 }
        window.__radius = 40
      }, isBounce)
      await site.evaluate(() => window.__fluid.step(40))
      const img = await site.evaluate(() => window.__fluid.read())
      // The rim is the outermost two columns; two cells in, the sign of the difference flips.
      return {
        rim: region(img, 0, 0.35, 2 / img.width, 0.65),
        inside: region(img, 0.05, 0.35, 0.2, 0.65),
      }
    }
    const bounce = await run(true)
    const open = await run(false)
    // Both runs moved the fluid toward the wall.
    expect(bounce.inside).toBeLessThan(250)
    expect(open.inside).toBeLessThan(250)
    // The two settings must not produce the same rim; which way is the investigation's question.
    // Measured: bounce rim 228, open rim 243, at these settings.
    expect(Math.abs(bounce.rim - open.rim)).toBeGreaterThan(5)
  }, 120_000)
})
