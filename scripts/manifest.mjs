// The demos' manifest, generated: one entry per component folder that has a
// `<Name>.demo.jsx`, its facts from the doc's front matter, written to
// src/manifest.js and committed (src/manifest.spec.md, manifest.12). A
// consumer imports `demos` from `cocoon-ai/demos` and reads a file; nothing
// runs. `npm run manifest` rewrites the file; src/manifest.test.js fails when
// the committed file differs from what this writes, and when an entry's files
// are missing. The front matter grammar is deliberately small: flat
// `key: value` lines, a value a string or an inline `[a, b]` list, quotes
// optional; anything else is refused naming the line, so a doc never carries
// YAML this reader silently misreads.
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { format, resolveConfig } from 'prettier'

/** The front matter every component doc opens with (docs.2), and which of them are lists. */
export const FIELDS = Object.freeze([
  'title',
  'summary',
  'credits',
  'since',
  'tags',
])
export const LISTS = new Set(['credits', 'tags'])
/** The fixed exports a `<Name>.demo.jsx` makes, read by the manifest's entry. */
export const DEMO_EXPORTS = Object.freeze([
  'demo',
  'schema',
  'scene',
  'effects',
])

const MANIFEST = 'src/manifest.js'

/**
 * A doc's front matter: a `---` line, flat `key: value` lines, a `---` line.
 * A value is a string, quoted or bare, or an inline list `[a, "b, c"]`.
 * Returns { data, body }; throws naming `where` and the line on anything else.
 */
export function parseFrontMatter(text, where = 'the doc') {
  const lines = text.split('\n')
  if (lines[0] !== '---')
    throw new Error(`${where}:1: no front matter; the first line must be ---`)
  const end = lines.indexOf('---', 1)
  if (end === -1)
    throw new Error(
      `${where}: the front matter never closes; a --- line ends it`,
    )
  const data = {}
  for (let i = 1; i < end; i++) {
    const at = `${where}:${i + 1}`
    const m = lines[i].match(/^([a-z][a-zA-Z0-9_-]*):\s*(.*)$/)
    if (!m) throw new Error(`${at}: not a \`key: value\` line`)
    const [, key, raw] = m
    if (key in data) throw new Error(`${at}: ${key} is given twice`)
    data[key] = parseValue(raw.trim(), at)
  }
  return { data, body: lines.slice(end + 1).join('\n') }
}

function parseValue(v, at) {
  if (v === '') throw new Error(`${at}: no value`)
  if (v.startsWith('[')) {
    if (!v.endsWith(']'))
      throw new Error(
        `${at}: a list opens with [ and closes with ] on one line`,
      )
    const inner = v.slice(1, -1).trim()
    return inner === '' ? [] : splitList(inner, at).map((s) => unquote(s, at))
  }
  return unquote(v, at)
}

/** Split on commas outside quotes. */
function splitList(inner, at) {
  const items = []
  let current = ''
  let quote = null
  for (const ch of inner) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (ch === ',') {
      items.push(current)
      current = ''
    } else current += ch
  }
  if (quote) throw new Error(`${at}: a quote never closes`)
  items.push(current)
  return items.map((s) => s.trim())
}

function unquote(s, at) {
  if (s.includes('\\'))
    throw new Error(`${at}: a backslash; this reader has no escapes`)
  const q = s[0]
  if (q === '"' || q === "'") {
    if (s.length < 2 || s[s.length - 1] !== q)
      throw new Error(`${at}: a quoted value must close with the same quote`)
    return s.slice(1, -1)
  }
  if (s === '') throw new Error(`${at}: an empty item`)
  if (/["'[\]]/.test(s))
    throw new Error(
      `${at}: a quote or bracket inside a bare value; quote the whole value`,
    )
  return s
}

/** The component folders under src that have a demo, by name: [{ name, demo, doc }]. */
export function discover(root) {
  const src = join(root, 'src')
  return readdirSync(src)
    .filter(
      (d) =>
        statSync(join(src, d)).isDirectory() &&
        existsSync(join(src, d, `${d}.demo.jsx`)),
    )
    .sort()
    .map((name) => ({
      name,
      demo: `src/${name}/${name}.demo.jsx`,
      doc: `docs/${name}.md`,
    }))
}

/** The entries with their front matter read and checked: throws naming the doc and the field. */
export function entriesOf(root) {
  return discover(root).map(({ name, demo, doc }) => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name))
      throw new Error(
        `src/${name}: a component folder's name must be an identifier, since the manifest imports it by name`,
      )
    const path = join(root, doc)
    if (!existsSync(path))
      throw new Error(
        `${doc} is missing; every component with a demo has a doc (docs.1)`,
      )
    const { data } = parseFrontMatter(readFileSync(path, 'utf8'), doc)
    for (const field of FIELDS) {
      if (!(field in data))
        throw new Error(`${doc}: the front matter has no ${field} (docs.2)`)
      if (Array.isArray(data[field]) !== LISTS.has(field))
        throw new Error(
          `${doc}: ${field} must be ${LISTS.has(field) ? 'a list [a, b]' : 'a string, not a list'}`,
        )
    }
    return { name, demo, doc, data }
  })
}

const HEADER = `// Generated by scripts/manifest.mjs from the component folders and the docs'
// front matter; never hand-edited (src/manifest.spec.md, manifest.12).
// \`npm run manifest\` rewrites it; src/manifest.test.js fails when it drifts.
// One entry per demo, in the order of the folders' names: the doc's front
// matter as data, the component and the demo module as direct imports, and
// the demo module's own facts (scene, schema, effects) through them.
`

/** The manifest module's source for the repo at `root`, formatted with the repo's prettier config. */
export async function generate(root) {
  const entries = entriesOf(root)
  const imports = entries
    .map(
      ({ name }) =>
        `import { ${name} } from './${name}/index.jsx'\n` +
        `import * as ${name}Demo from './${name}/${name}.demo.jsx'`,
    )
    .join('\n')
  const items = entries
    .map(
      ({ name, doc, data }) => `  Object.freeze({
    name: ${JSON.stringify(name)},
    title: ${JSON.stringify(data.title)},
    summary: ${JSON.stringify(data.summary)},
    since: ${JSON.stringify(data.since)},
    credits: Object.freeze(${JSON.stringify(data.credits)}),
    tags: Object.freeze(${JSON.stringify(data.tags)}),
    doc: ${JSON.stringify(doc)},
    scene: ${name}Demo.scene,
    component: ${name},
    demo: ${name}Demo.demo,
    schema: ${name}Demo.schema,
    effects: ${name}Demo.effects,
  }),`,
    )
    .join('\n')
  const code = `${HEADER}${imports ? `${imports}\n` : ''}
/** Every demo the package ships, one entry each; see src/manifest.spec.md. */
export const demos = Object.freeze([
${items}
])
`
  const options = await resolveConfig(join(root, MANIFEST))
  return format(code, { ...options, filepath: MANIFEST })
}

/** Write src/manifest.js for the repo at `root`; returns the entry count. */
export async function write(root) {
  const code = await generate(root)
  writeFileSync(join(root, MANIFEST), code)
  return entriesOf(root).length
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..')
  try {
    const n = await write(root)
    console.log(
      `manifest: ${n} ${n === 1 ? 'entry' : 'entries'} written to ${MANIFEST}`,
    )
  } catch (e) {
    console.error(`manifest: ${e.message}`)
    process.exit(1)
  }
}
