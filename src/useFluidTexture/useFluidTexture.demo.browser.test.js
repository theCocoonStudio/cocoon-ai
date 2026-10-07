import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { findBrowser, openPage } from '../test/browser.js'

// The fluid's demo in the site's shape: one full-viewport Canvas on the WebGPU
// renderer, a perspective camera, the tunnel's Out, and the demo in a div at a
// known rectangle. What is measured: that the plane covers that rectangle and
// nothing else (placement, no scissor), that a pointer stroke across the demo
// moves the fluid (the pointer mapped into the rectangle), that the sidebar's
// inputs reach the scene (the standard material with its light renders lit),
// and that an environment loads from the assets package without a page error.
// The page is wide enough for the sidebar to open beside a stage that keeps a
// width; the stage's rectangle is read back as measured when it is open.
// Numbers measured 2026-10-07 on Linux, Chromium 154 under SwiftShader.

const browser = findBrowser()
const ENTRY = resolve(
  import.meta.dirname,
  'useFluidTexture.demo.browser-entry.jsx',
)
const PAGE = { width: 320, height: 192 }
const RECT = { x: 16, y: 8, width: 288, height: 160 }

const at = (img, x, y) => img.grey[y * img.width + x]
const alphaAt = (img, x, y) => img.alpha[y * img.width + x]
/** Mean grey over a rectangle of the image, x0..x1 by y0..y1 in px, row 0 the top. */
function region(img, x0, y0, x1, y1) {
  let sum = 0
  let n = 0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      sum += at(img, x, y)
      n++
    }
  return sum / n
}
/** The middle of a measured rectangle, 30% in from each side. */
const inner = (img, r) =>
  region(
    img,
    Math.round(r.x + r.width * 0.3),
    Math.round(r.y + r.height * 0.3),
    Math.round(r.x + r.width * 0.7),
    Math.round(r.y + r.height * 0.7),
  )
const read = () => site.evaluate(() => window.__demo.read())
const settle = (ms = 600) => new Promise((r) => setTimeout(r, ms))
let site

describe.skipIf(!browser)('FluidTextureDemo in the browser', () => {
  beforeAll(async () => {
    site = await openPage(ENTRY, PAGE)
    await settle()
  }, 120_000)
  afterAll(async () => site && (await site.close()))

  it("the plane covers the demo's rectangle exactly and nothing outside it: inside is the fluid at rest, outside is the clear colour", async () => {
    const img = await read()
    expect(img.width).toBe(PAGE.width)
    // inside, one px in from each edge: the picture, white at rest through the basic material's tone mapping
    const inset = [
      [RECT.x + 1, RECT.y + 1],
      [RECT.x + RECT.width - 2, RECT.y + 1],
      [RECT.x + 1, RECT.y + RECT.height - 2],
      [RECT.x + RECT.width - 2, RECT.y + RECT.height - 2],
      [RECT.x + RECT.width / 2, RECT.y + RECT.height / 2],
    ]
    for (const [x, y] of inset) expect(at(img, x, y)).toBeGreaterThan(150)
    // outside, one px beyond each edge: nothing drawn, alpha 0
    const outset = [
      [RECT.x - 2, RECT.y + RECT.height / 2],
      [RECT.x + RECT.width + 1, RECT.y + RECT.height / 2],
      [RECT.x + RECT.width / 2, RECT.y - 2],
      [RECT.x + RECT.width / 2, RECT.y + RECT.height + 1],
    ]
    for (const [x, y] of outset) expect(alphaAt(img, x, y)).toBe(0)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('a pointer stroke across the demo moves the fluid where the pointer went: the centre darkens, the far corner does not', async () => {
    const cx = RECT.x + RECT.width / 2
    const cy = RECT.y + RECT.height / 2
    const before = region(await read(), cx - 8, cy - 8, cx + 8, cy + 8)
    // a strong, fast stroke through the centre: the pointer diff is read once per step, so each move is one impulse
    await site.evaluate(() => {
      window.__demo.set('forceValue', '10')
      window.__demo.set('forceSize', '60')
    })
    for (let i = 0; i < 12; i++) {
      await site.evaluate(
        (x, y) => window.__demo.stroke([[x, y]]),
        cx - 48 + i * 8,
        cy,
      )
      await settle(25)
    }
    await settle(150)
    const after = await read()
    const centre = region(after, cx - 8, cy - 8, cx + 8, cy + 8)
    const corner = region(
      after,
      RECT.x + 2,
      RECT.y + 2,
      RECT.x + 12,
      RECT.y + 12,
    )
    expect(centre).toBeLessThan(before - 30)
    expect(corner).toBeGreaterThan(150)
  }, 60_000)

  it('the sidebar drives the scene: the standard material with its directional light renders lit, not black, and the probe is in the DOM', async () => {
    await site.reload(() => {
      window.__openSettings = true
    })
    await settle()
    const dom = await site.evaluate(() => ({
      settings: !!document.querySelector('.cocoon-demo__settings'),
      labels: [
        ...document.querySelectorAll('.cocoon-demo__settings label'),
      ].map((l) => l.textContent),
      probe: !!document.querySelector('.cocoon-demo__probe'),
    }))
    expect(dom.settings).toBe(true)
    expect(dom.probe).toBe(true)
    expect(dom.labels).toContain('forceValue')
    await site.evaluate(() => window.__demo.set('material', 'standard'))
    await settle()
    // the sidebar is open, so the stage is narrower than the rectangle: sample inside the stage as measured
    const stage = await site.evaluate(() => window.__demo.stage())
    expect(stage.width).toBeGreaterThan(40)
    expect(inner(await read(), stage)).toBeGreaterThan(40)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('an environment from the assets package loads into the material without a page error', async () => {
    const stage = await site.evaluate(() => window.__demo.stage())
    await site.evaluate(() => window.__demo.set('environment', 'room'))
    await settle(800)
    expect(inner(await read(), stage)).toBeGreaterThan(20)
    await site.evaluate(() => window.__demo.set('environment', 'studio'))
    await settle(2000)
    expect(inner(await read(), stage)).toBeGreaterThan(20)
    expect(site.errors).toEqual([])
  }, 90_000)
})
