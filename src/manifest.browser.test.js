import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { demos } from './manifest.js'
import { findBrowser, openPage } from './test/browser.js'

// The fit test (src/manifest.spec.md, tests.1): a page shaped like the
// consumer's, every manifest entry rendered through its demo the way the site
// will, one Canvas outside the page. What is measured: every entry mounts; a
// scene demo shows the loader, reports ready and the loader leaves; a markup
// demo renders with the Canvas's scene untouched; the sidebar's labels are the
// schema's visible entries and a control takes a change; and each scene
// demo's time to ready is within its recorded budget. The site permission
// after this run verifies the same page against the real consumer (tests.2).
// Numbers measured 2026-10-18 on Linux, Chromium under SwiftShader.

const browser = findBrowser()
const ENTRY = resolve(import.meta.dirname, 'manifest.browser-entry.jsx')
const RECT = { height: 160, gap: 16 }
const PAGE = {
  width: 320,
  height: RECT.gap + demos.length * (RECT.height + RECT.gap),
}

/**
 * budget.2: each scene demo's cold compile, mount to onReady on the harness's
 * Chromium under SwiftShader, held to twice the slowest measure seen, which is
 * GitHub's two-core runner with the other browser tests beside it (the
 * harness's rule: sized for the slowest runner, with the number and the date);
 * a new scene demo adds its line at its first run.
 */
const READY_BUDGET_MS = {
  useFluidTexture: 6_200, // measured 511 ms here and 3,065 ms on GitHub's runner (run 39102297104, 2026-10-18); twice the slowest
}

const sceneEntries = demos.filter((e) => e.scene)
const markupEntries = demos.filter((e) => !e.scene)
/** The schema's entries shown at the defaults: those with no `when`, or whose `when` holds. */
const visibleLabels = (schema) =>
  Object.entries(schema)
    .filter(([, e]) => !e.when || schema[e.when.key].default === e.when.value)
    .map(([key, e]) => e.label ?? key)

const settle = (ms = 600) => new Promise((r) => setTimeout(r, ms))
let site
const entries = () => site.evaluate(() => window.__fit.entries())

describe.skipIf(!browser)(
  'the manifest on a page shaped like the consumer',
  () => {
    beforeAll(async () => {
      site = await openPage(ENTRY, PAGE)
      // every scene demo ready, however loaded the machine: the budget is the page's own measure, not this wait
      await site.page.waitForFunction(
        () =>
          window.__fit.entries().every((e) => !e.scene || e.readyMs !== null),
        { timeout: 60_000 },
      )
      await settle(300)
    }, 120_000)
    afterAll(async () => site && (await site.close()))

    it('tests.1 every entry mounts through its demo in its own container, with no page error', async () => {
      const facts = await entries()
      expect(facts.map((f) => f.name)).toEqual(demos.map((e) => e.name))
      for (const f of facts)
        expect(f.mounted, `${f.name} did not mount`).toBe(true)
      expect(site.errors).toEqual([])
    })

    it('loading.3 and 4: each scene demo reported ready, its loader left the stage, and its handle holds root, materials and compile', async () => {
      const facts = (await entries()).filter((f) => f.scene)
      expect(facts.length).toBe(sceneEntries.length)
      for (const f of facts) {
        expect(f.readyMs, `${f.name} never reported ready`).not.toBeNull()
        expect(f.loader, `${f.name}'s loader is still in the stage`).toBe(false)
        expect(f.handle, `${f.name} exposed no handle`).toEqual({
          root: true,
          materials: expect.any(Number),
          compile: 'function',
        })
        expect(f.handle.materials).toBeGreaterThan(0)
      }
    })

    it.skipIf(markupEntries.length === 0)(
      'consumer.1 a markup demo renders with no loader, no handle and the Canvas untouched (no markup demo exists yet: skipped)',
      async () => {
        const facts = (await entries()).filter((f) => !f.scene)
        for (const f of facts) {
          expect(f.loader).toBe(false)
          expect(f.handle).toBeNull()
        }
      },
    )

    it("consumer.4 each sidebar's labels are the schema's visible entries, and a control takes a change", async () => {
      const facts = await entries()
      for (const f of facts) {
        const entry = demos.find((e) => e.name === f.name)
        expect(f.labels, f.name).toEqual(visibleLabels(entry.schema))
        const [key, e] = Object.entries(entry.schema).find(
          ([, s]) => s.kind === 'number' && !s.when,
        )
        await site.evaluate(
          (name, label, value) => window.__fit.set(name, label, value),
          f.name,
          e.label ?? key,
          String(e.max),
        )
      }
      await settle(200)
      expect(site.errors).toEqual([])
    })

    it('budget.2 each scene demo is ready within its recorded budget', async () => {
      const facts = (await entries()).filter((f) => f.scene)
      for (const f of facts) {
        expect(
          READY_BUDGET_MS[f.name],
          `no ready budget recorded for ${f.name}; measure it and add the line`,
        ).toBeDefined()
        expect(
          f.readyMs,
          `${f.name} was ready ${Math.round(f.readyMs)} ms after mount, over its budget of ${READY_BUDGET_MS[f.name]} ms`,
        ).toBeLessThanOrEqual(READY_BUDGET_MS[f.name])
      }
    })
  },
)
