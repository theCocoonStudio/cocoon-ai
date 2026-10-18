import { afterEach, assert, test } from 'vitest'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  DEMO_EXPORTS,
  discover,
  entriesOf,
  generate,
  parseFrontMatter,
} from './manifest.mjs'

// The reader on strings, the discovery and the generator on a fixture repo
// in a temp dir: what each refusal names, and the shape of what is written.

const fm = (lines) => `---\n${lines.join('\n')}\n---\nbody\n`
const refuses = (text, re) =>
  assert.throws(() => parseFrontMatter(text, 'docs/X.md'), re)

test('a flat front matter reads as strings and lists, quoted or bare, and the body is what follows', () => {
  const { data, body } = parseFrontMatter(
    fm([
      'title: Fluid texture',
      "summary: 'A plane: the fluid, in one sentence.'",
      'credits: ["Izzy Erlich", Claude, "mnmxmx, fluid-three"]',
      'since: 2026-09-15',
      'tags: []',
    ]),
    'docs/X.md',
  )
  assert.deepEqual(data, {
    title: 'Fluid texture',
    summary: 'A plane: the fluid, in one sentence.',
    credits: ['Izzy Erlich', 'Claude', 'mnmxmx, fluid-three'],
    since: '2026-09-15',
    tags: [],
  })
  assert.equal(body, 'body\n')
})

test('every refusal names the doc and the line', () => {
  refuses('# no front matter\n', /docs\/X\.md:1: no front matter/)
  refuses('---\ntitle: x\n', /never closes/)
  refuses(
    fm(['title: x', 'not a line']),
    /docs\/X\.md:3: not a `key: value` line/,
  )
  refuses(fm(['title: x', 'title: y']), /:3: title is given twice/)
  refuses(fm(['title:']), /:2: no value/)
  refuses(fm(['tags: [a, b']), /:2: a list opens with \[ and closes with \]/)
  refuses(fm(['tags: ["a, b]']), /:2: a quote never closes/)
  refuses(fm(['title: "x']), /:2: a quoted value must close/)
  refuses(fm(['title: a "b" c']), /:2: a quote or bracket inside a bare value/)
  refuses(fm(['tags: [a, , b]']), /:2: an empty item/)
  refuses(fm(['title: a\\nb']), /:2: a backslash/)
  refuses(fm(['Title: x']), /:2: not a `key: value` line/)
})

let dir
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

/** A fixture repo: component folders with or without a demo, docs with the given front matter. */
function repo(components) {
  dir = mkdtempSync(join(tmpdir(), 'cocoon-manifest-'))
  // the repo's prettier config, so the generated text is in the repo's style here too
  copyFileSync(
    resolve(import.meta.dirname, '..', '.prettierrc'),
    join(dir, '.prettierrc'),
  )
  mkdirSync(join(dir, 'docs'))
  for (const [name, { demo, doc }] of Object.entries(components)) {
    mkdirSync(join(dir, 'src', name), { recursive: true })
    writeFileSync(
      join(dir, 'src', name, 'index.jsx'),
      `export const ${name} = 1\n`,
    )
    if (demo)
      writeFileSync(
        join(dir, 'src', name, `${name}.demo.jsx`),
        DEMO_EXPORTS.map((e) => `export const ${e} = 0`).join('\n'),
      )
    if (doc !== undefined) writeFileSync(join(dir, 'docs', `${name}.md`), doc)
  }
  return dir
}
const good = (title = 'Title') =>
  fm([
    `title: ${title}`,
    'summary: One sentence.',
    'credits: [Izzy Erlich, Claude]',
    'since: 2026-10-07',
    'tags: [three]',
  ])

test('discover lists the folders with a demo, by name, and skips the rest', () => {
  const root = repo({
    Zeta: { demo: true, doc: good() },
    Alpha: { demo: true, doc: good() },
    Plain: { demo: false, doc: good() },
  })
  assert.deepEqual(
    discover(root).map((e) => e.name),
    ['Alpha', 'Zeta'],
  )
  assert.deepEqual(discover(root)[0], {
    name: 'Alpha',
    demo: 'src/Alpha/Alpha.demo.jsx',
    doc: 'docs/Alpha.md',
  })
})

test('entriesOf refuses a demo without a doc, a doc without a field, and a field of the wrong shape, naming each', () => {
  assert.throws(
    () => entriesOf(repo({ Alpha: { demo: true } })),
    /docs\/Alpha\.md is missing/,
  )
  assert.throws(
    () =>
      entriesOf(
        repo({ Alpha: { demo: true, doc: fm(['title: x', 'summary: y']) } }),
      ),
    /docs\/Alpha\.md: the front matter has no credits \(docs\.2\)/,
  )
  assert.throws(
    () =>
      entriesOf(
        repo({
          Alpha: {
            demo: true,
            doc: fm([
              'title: x',
              'summary: y',
              'credits: Claude',
              'since: 2026-10-07',
              'tags: []',
            ]),
          },
        }),
      ),
    /docs\/Alpha\.md: credits must be a list/,
  )
  assert.throws(
    () =>
      entriesOf(
        repo({
          Alpha: {
            demo: true,
            doc: fm([
              'title: [x]',
              'summary: y',
              'credits: [Claude]',
              'since: 2026-10-07',
              'tags: []',
            ]),
          },
        }),
      ),
    /docs\/Alpha\.md: title must be a string, not a list/,
  )
})

test('generate writes one import pair and one frozen entry per demo, the front matter as data, the demo facts through the module', async () => {
  const code = await generate(
    repo({ Alpha: { demo: true, doc: good('Alpha, titled') } }),
  )
  assert.include(code, "import { Alpha } from './Alpha/index.jsx'")
  assert.include(code, "import * as AlphaDemo from './Alpha/Alpha.demo.jsx'")
  assert.include(code, 'export const demos = Object.freeze([')
  for (const line of [
    "name: 'Alpha'",
    "title: 'Alpha, titled'",
    "summary: 'One sentence.'",
    "since: '2026-10-07'",
    "credits: Object.freeze(['Izzy Erlich', 'Claude'])",
    "tags: Object.freeze(['three'])",
    "doc: 'docs/Alpha.md'",
    'scene: AlphaDemo.scene',
    'component: Alpha',
    'demo: AlphaDemo.demo',
    'schema: AlphaDemo.schema',
    'effects: AlphaDemo.effects',
  ])
    assert.include(code, line)
  assert.match(code, /^\/\/ Generated by scripts\/manifest\.mjs/)
})

test('generate with no demo writes an empty list and no import', async () => {
  const code = await generate(repo({ Plain: { demo: false, doc: good() } }))
  assert.notMatch(code, /^import /m)
  assert.include(code, 'export const demos = Object.freeze([])')
})
