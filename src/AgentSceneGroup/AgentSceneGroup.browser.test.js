import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { findBrowser, openPage } from '../test/browser.js'
import fixture from './fixtures/turn.json'

// The fit test (AgentSceneGroup.spec.md, tests.3): the consumer's shape in
// miniature, the component mounted through the tunnel with the fixture's
// template, the recorded stream replayed event by event on both backends.
// What is measured: the scene's state after each event and at done (through
// the handle), onReady once, onCompile in pairs on structural events, a value
// event visible within one frame (budget.2), and the first compile's time
// against its budget (budget.1).

const browser = findBrowser()
const ENTRY = resolve(import.meta.dirname, 'AgentSceneGroup.browser-entry.jsx')
const PAGE = { width: 320, height: 240 }

/**
 * budget.1: the template's first compile, mount to onReady, on the harness's
 * Chromium under SwiftShader; the number recorded at the first run and held
 * to twice the slowest measure seen, as the harness sizes every timeout.
 */
const READY_BUDGET_MS = 6_200 // measured 2026-10-29 here:  on webgpu,  on webgl (Linux, Chromium under SwiftShader); held to the manifest fit test's budget, sized on GitHub's runner on 2026-10-18 (3,065 ms there against 511 here); the runner's own number for this scene recorded at its first run

const turn = (n) => fixture.turns[n]
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms))
let site
const facts = () => site.evaluate(() => window.__agent.facts())
const emit = (event) => site.evaluate((e) => window.__agent.emit(e), event)
const waitCompiled = (count) =>
  site.page.waitForFunction(
    (n) => window.__agent.facts().compileEvents.length >= n,
    { timeout: 30_000 },
    count,
  )

const backends = [
  { name: 'webgpu', init: () => {} },
  {
    name: 'webgl',
    init: () => {
      window.__forceWebGL = true
    },
  },
]

describe.skipIf(!browser)('AgentSceneGroup in the browser', () => {
  beforeAll(async () => {
    site = await openPage(ENTRY, PAGE)
  }, 120_000)
  afterAll(async () => site && (await site.close()))

  for (const backend of backends) {
    describe(`on ${backend.name}`, () => {
      beforeAll(async () => {
        if (backend.name === 'webgl') await site.reload(backend.init)
        await site.page.waitForFunction(
          () => window.__agent && window.__agent.facts().readyMs !== null,
          { timeout: 60_000 },
        )
      }, 120_000)

      it("[markup.1] [markup.2] [handle.5] [handle.6] mounted through the tunnel: the template's objects under the group, the background on the Canvas's scene, the backend declared", async () => {
        const f = await facts()
        expect(f.children.map((c) => c.uuid)).toEqual([
          'mesh-main',
          'light-ambient',
        ])
        expect(f.background).toBe(fixture.template.object.background)
        expect(f.backend).toBe(
          backend.name === 'webgl' && site.webgpu ? 'webgl' : f.backend,
        )
        expect(['webgpu', 'webgl']).toContain(f.backend)
        expect(f.version).toBe(fixture.version)
        expect(f.hash).toBe(fixture.templateHash)
        expect(site.errors).toEqual([])
      })

      it('[callbacks.1] [budget.1] onReady fired once, within the budget', async () => {
        const f = await facts()
        expect(f.readyMs).not.toBeNull()
        console.log(
          `AgentSceneGroup ready ${Math.round(f.readyMs)} ms after mount on ${f.backend}`,
        )
        expect(
          f.readyMs,
          `ready ${Math.round(f.readyMs)} ms after mount, over the budget of ${READY_BUDGET_MS} ms`,
        ).toBeLessThanOrEqual(READY_BUDGET_MS)
      })

      it('[effects.2] [budget.2] the first turn replayed: a set is visible within one frame, the add appends the light behind onCompile true then false, the hash follows', async () => {
        const [set1, set2, add, say] = turn(0).events
        const before = await facts()
        const afterSet = await site.evaluate((e) => {
          window.__agent.emit(e)
          return window.__agent.afterFrame()
        }, set1)
        expect(afterSet.colour).toBe(0xff0000)
        expect(afterSet.hash).toBe(set1.hash)
        await emit(set2)
        await emit(add)
        await waitCompiled(before.compileEvents.length + 2)
        await emit(say)
        const f = await facts()
        expect(f.roughness).toBe(0.2)
        expect(f.children.map((c) => c.uuid)).toEqual([
          'mesh-main',
          'light-ambient',
          'slot:light.key',
        ])
        expect(f.children[2].type).toBe('PointLight')
        expect(f.compileEvents.slice(before.compileEvents.length)).toEqual([
          true,
          false,
        ])
        expect(f.hash).toBe(add.hash)
        expect(site.errors).toEqual([])
      })

      it("[effects.2] the second turn: fog on the Canvas's scene, a light added and removed, the size rebuilt; the third: undo and reset back to the template", async () => {
        const before = await facts()
        for (const e of turn(1).events) {
          await emit(e)
          if (e.change === 'add')
            await waitCompiled(before.compileEvents.length + 2)
        }
        await settle()
        let f = await facts()
        expect(f.fogNear).toBe(5)
        expect(f.width).toBe(1.5)
        expect(f.children.map((c) => c.uuid)).toEqual([
          'mesh-main',
          'light-ambient',
          'slot:light.key',
        ])
        expect(f.hash).toBe(turn(1).done.hash)
        for (const e of turn(2).events) await emit(e)
        await settle()
        f = await facts()
        expect(f.children.map((c) => c.uuid)).toEqual([
          'mesh-main',
          'light-ambient',
        ])
        expect(f.colour).toBe(fixture.template.materials[0].color)
        expect(f.fogNear).toBeNull()
        expect(f.hash).toBe(fixture.templateHash)
        expect(site.errors).toEqual([])
      })

      it('[effects.1] [states.pending] a done with other nodes loads afresh behind onCompile and swaps the objects in; a done with the same nodes writes in place', async () => {
        const before = await facts()
        await emit(turn(1).done)
        await waitCompiled(before.compileEvents.length + 2)
        await settle()
        let f = await facts()
        expect(f.children.map((c) => c.uuid)).toEqual([
          'mesh-main',
          'light-ambient',
          'slot:light.key',
        ])
        expect(f.colour).toBe(0xff0000)
        expect(f.width).toBe(1.5)
        expect(f.hash).toBe(turn(1).done.hash)
        const recoloured = structuredClone(turn(1).done.document)
        recoloured.materials[0].color = 0x00ff00
        await emit({ type: 'done', document: recoloured, hash: 'h-recoloured' })
        await settle(100)
        f = await facts()
        expect(f.colour).toBe(0x00ff00)
        expect(f.compileEvents.length).toBe(before.compileEvents.length + 2)
        expect(f.hash).toBe('h-recoloured')
        expect(site.errors).toEqual([])
      })
    })
  }
})
