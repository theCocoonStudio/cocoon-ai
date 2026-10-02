import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { findBrowser, openPage } from '../test/browser.js'

// Both providers in a real document through Chromium: real scrolling, a real
// ResizeObserver, real frames. The jsdom tests drive mocks; these are the same
// contracts against the browser. src/test/browser.js is the harness.

const browser = findBrowser()
const ENTRY = resolve(import.meta.dirname, 'ScrollProvider.browser-entry.jsx')

// the root is 200 × 100, three sections of 100: ranges [0,0], [0,100], [100,200]

describe.skipIf(!browser)('ScrollProvider in the browser', () => {
  let site
  beforeAll(async () => {
    site = await openPage(ENTRY, { width: 200, height: 100 })
  }, 120_000)
  afterAll(async () => site && (await site.close()))

  it('props.2 mounts at section 0 with no page errors', async () => {
    const r = await site.evaluate(() => window.__scroll.read())
    expect(r.scrollTop).toBe(0)
    expect(r.index).toBe(0)
    expect(r.rendered).toBe(0)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('effects.1 a real scroll updates the ref and the section within two frames', async () => {
    await site.evaluate(() => window.__scroll.scrollTo(150))
    const r = await site.evaluate(() => window.__scroll.read())
    expect(r.scrollTop).toBe(150)
    expect(r.index).toBe(2)
    expect(r.offset).toBe(0.5)
    expect(r.rendered).toBe(2)
  }, 60_000)

  it('effects.1 the loop stops when scrolling stops', async () => {
    await site.evaluate(() => window.__scroll.scrollTo(50))
    const a = await site.evaluate(() => window.__scroll.read())
    await site.evaluate(() => window.__scroll.frame(5))
    const b = await site.evaluate(() => window.__scroll.read())
    expect(b.frames).toBe(a.frames)
    expect(b.scrollTop).toBe(50)
    expect(b.index).toBe(1)
  }, 60_000)

  it('effects.2 a real resize of the sections re-runs the features at the same scrollTop', async () => {
    await site.evaluate(() => window.__scroll.scrollTo(150))
    expect((await site.evaluate(() => window.__scroll.read())).index).toBe(2)
    // sections of 200: ranges [0,100], [100,300], [300,500]; 150 is section 1
    await site.evaluate(() => window.__scroll.setSectionHeight(200))
    await site.evaluate(() => window.__scroll.frame(3))
    const r = await site.evaluate(() => window.__scroll.read())
    expect(r.scrollTop).toBe(150)
    expect(r.index).toBe(1)
    expect(r.offset).toBe(0.25)
    expect(r.rendered).toBe(1)
    expect(site.errors).toEqual([])
  }, 60_000)

  it('context.hook.1 useResizeEvent follows a real resize through a real observer', async () => {
    await site.reload()
    let s = (await site.evaluate(() => window.__scroll.read())).sized
    expect(s).toEqual({ width: 50, height: 20 })
    await site.evaluate(() => window.__scroll.setSizedWidth(80))
    await site.evaluate(() => window.__scroll.frame(3))
    s = (await site.evaluate(() => window.__scroll.read())).sized
    expect(s).toEqual({ width: 80, height: 20 })
    expect(site.errors).toEqual([])
  }, 60_000)
})
