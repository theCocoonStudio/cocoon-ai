import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { demos } from './manifest.js'
import { EFFECTS } from './Demo/effects.js'
import { discover, generate } from '../scripts/manifest.mjs'

// The manifest as committed against the repo it describes (src/manifest.spec.md
// manifest.13, budget.1, budget.2): every demo file has an entry and every
// entry its files; the fields have their shapes; the scene flag agrees with
// the file's use of the tunnel; the committed module is what the generator
// writes; the sizes. The structure test holds the docs' text checks; this
// file imports the module, which is why it is separate.

const ROOT = resolve(import.meta.dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const MANIFEST = 'src/manifest.js'
const EFFECT_VALUES = new Set(Object.values(EFFECTS))

/**
 * budget.2: each demo's chunk, the demo module bundled alone and minified with
 * the peers external (what a consumer's route carries for it), measured on
 * 2026-10-18 on Linux with vite 8.2.2 and held to the measure plus a tenth.
 * A new demo adds its line at its first run. Compile time is the fit test's.
 */
const CHUNK_BUDGET = {
  useFluidTexture: 39_000, // measured 35,318 bytes
}

/** The demo module bundled alone, minified, the peers external, in bytes. */
async function chunkBytes(file) {
  const { build } = await import('vite')
  const peers = Object.keys(JSON.parse(read('package.json')).peerDependencies)
  const result = await build({
    configFile: false,
    root: ROOT,
    mode: 'production',
    logLevel: 'silent',
    esbuild: { jsx: 'automatic', jsxDev: false },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      lib: {
        entry: join(ROOT, file),
        formats: ['es'],
        fileName: () => 'chunk.js',
      },
      rollupOptions: {
        external: [
          ...peers,
          ...peers.map((n) => new RegExp(`^${n}/`)),
          'react/jsx-runtime',
        ],
        output: { codeSplitting: false },
      },
    },
  })
  const out = Array.isArray(result) ? result[0] : result
  return Buffer.byteLength(out.output[0].code)
}

describe('manifest', () => {
  it("manifest.1 one frozen entry per demo file, in the order of the folders' names", () => {
    expect(Object.isFrozen(demos)).toBe(true)
    expect(demos.map((e) => e.name)).toEqual(discover(ROOT).map((d) => d.name))
    for (const e of demos)
      expect(Object.isFrozen(e), `${e.name}'s entry is not frozen`).toBe(true)
  })

  for (const entry of demos) {
    describe(entry.name, () => {
      const demoFile = `src/${entry.name}/${entry.name}.demo.jsx`

      it('manifest.13 its component, demo and doc exist', () => {
        for (const file of [
          `src/${entry.name}/index.jsx`,
          demoFile,
          `docs/${entry.name}.md`,
        ])
          expect(
            existsSync(join(ROOT, file)),
            `${file} is missing for the manifest entry ${entry.name}`,
          ).toBe(true)
      })

      it('manifest.2–11 and docs.6 the fields have their shapes', () => {
        for (const field of ['name', 'title', 'summary', 'since', 'doc']) {
          expect(typeof entry[field], `${entry.name}.${field}`).toBe('string')
          expect(entry[field].length, `${entry.name}.${field}`).toBeGreaterThan(
            0,
          )
        }
        expect(entry.doc).toBe(`docs/${entry.name}.md`)
        for (const field of ['credits', 'tags']) {
          expect(Array.isArray(entry[field]), `${entry.name}.${field}`).toBe(
            true,
          )
          for (const v of entry[field])
            expect(typeof v, `${entry.name}.${field}`).toBe('string')
        }
        expect(typeof entry.scene, `${entry.name}.scene`).toBe('boolean')
        expect(typeof entry.component, `${entry.name}.component`).toBe(
          'function',
        )
        expect(typeof entry.demo, `${entry.name}.demo`).toBe('function')
        expect(
          entry.schema && typeof entry.schema === 'object',
          `${entry.name}.schema is not an object`,
        ).toBe(true)
        // plain data: a consumer renders the controls from it without the scene
        expect(JSON.parse(JSON.stringify(entry.schema))).toEqual(entry.schema)
        expect(Array.isArray(entry.effects), `${entry.name}.effects`).toBe(true)
        for (const v of entry.effects)
          expect(
            EFFECT_VALUES.has(v),
            `${entry.name}.effects holds ${v}, not an EFFECTS value`,
          ).toBe(true)
      })

      it("manifest.4 and amend.1 the scene flag agrees with the demo file's use of the tunnel", () => {
        const usesTunnel = /\btunnel\b/.test(read(demoFile))
        expect(
          entry.scene,
          `${demoFile} ${usesTunnel ? 'uses' : 'does not use'} the tunnel but exports scene ${entry.scene}`,
        ).toBe(usesTunnel)
      })

      it('budget.2 its chunk, minified with the peers external, is within the recorded budget', async () => {
        expect(
          CHUNK_BUDGET[entry.name],
          `no chunk budget recorded for ${entry.name}; measure it and add the line to CHUNK_BUDGET`,
        ).toBeDefined()
        const bytes = await chunkBytes(demoFile)
        expect(
          bytes,
          `${demoFile} bundles to ${bytes} bytes, over its budget of ${CHUNK_BUDGET[entry.name]}`,
        ).toBeLessThanOrEqual(CHUNK_BUDGET[entry.name])
      })
    })
  }

  it('manifest.12 the committed module is what the generator writes', async () => {
    expect(
      read(MANIFEST),
      `${MANIFEST} differs from what scripts/manifest.mjs writes; run \`npm run manifest\` and commit the file`,
    ).toBe(await generate(ROOT))
  })

  it('budget.1 the module is under 8 kB before compression', () => {
    expect(statSync(join(ROOT, MANIFEST)).size).toBeLessThan(8_000)
  })
})
