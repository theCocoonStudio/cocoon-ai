import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from '../cocoon.config.js'

// The repo's structure as tests: what a script can decide yes or no from the
// files alone, so a stale entry fails on the author's machine rather than in
// review. Every failure names where the fact came from and where the fix goes.
// Truth of a doc, and whether two docs mean the same, stay with the review.

const ROOT = resolve(import.meta.dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const lines = (p) => read(p).split('\n')
/** 1-based line of the first line matching `re` in file `p`, for messages. */
const lineOf = (p, re) => lines(p).findIndex((l) => re.test(l)) + 1

describe('README scripts table', () => {
  const pkg = JSON.parse(read('package.json'))
  const readme = read('README.md')
  for (const name of Object.keys(pkg.scripts)) {
    const invocation = name === 'test' ? 'npm test' : `npm run ${name}`
    it(`has a row for ${invocation}`, () => {
      expect(
        readme.includes(`\`${invocation}\``) ||
          readme.includes(`\`${invocation} `),
        `README.md scripts table has no row for \`${invocation}\` (package.json "scripts" at line ${lineOf('package.json', new RegExp(`^\\s*"${name}":`))}); add a row to the table under "## Scripts"`,
      ).toBe(true)
    })
  }

  it('links only to docs that exist', () => {
    const links = [...readme.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1])
    for (const link of links)
      expect(
        existsSync(join(ROOT, link)),
        `README.md links to ${link} at line ${lineOf('README.md', new RegExp(link.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')))}, which does not exist`,
      ).toBe(true)
  })
})

/** Prop names a component declares in its JSDoc: `@property` lines of its Props typedef, or `@param` lines on `props.x`. */
function declaredProps(file) {
  const src = lines(file)
  const props = []
  let inProps = false
  src.forEach((l, i) => {
    const typedef = l.match(/@typedef \{object\} (\w+)/)
    if (typedef) inProps = /Props$/.test(typedef[1])
    if (/^\s*\*\/\s*$/.test(l)) inProps = false
    let m
    if (inProps && (m = l.match(/@property \{[^}]*\} \[?(\w+)/)))
      props.push({ name: m[1], line: i + 1 })
    else if ((m = l.match(/@param \{[^}]*\} \[?props\.(\w+)/)))
      props.push({ name: m[1], line: i + 1 })
  })
  return props
}

describe('component folders', () => {
  // utils/ holds React-free functions and test/ holds test helpers; the rest are components.
  const components = readdirSync(join(ROOT, 'src')).filter(
    (d) =>
      d !== 'utils' &&
      d !== 'test' &&
      statSync(join(ROOT, 'src', d)).isDirectory(),
  )
  const index = read('src/index.js')

  for (const name of components) {
    const dir = `src/${name}`
    it(`${name} has its component, spec, resolved spec, tests and doc`, () => {
      for (const file of [
        `${dir}/index.jsx`,
        `${dir}/${name}.spec.md`,
        `${dir}/${name}.resolved.md`,
        `${dir}/${name}.test.jsx`,
        `docs/${name}.md`,
      ])
        expect(
          existsSync(join(ROOT, file)),
          `${file} is missing; the layout in README.md "## Layout" names it`,
        ).toBe(true)
    })

    it(`${name} is exported from src/index.js`, () => {
      expect(
        new RegExp(
          `export \\{[^}]*\\b${name}\\b[^}]*\\} from './${name}/index.jsx'`,
        ).test(index),
        `src/index.js has no \`export { ${name} } from './${name}/index.jsx'\``,
      ).toBe(true)
    })

    it(`${name}'s doc names every prop its JSDoc declares`, () => {
      const doc = read(`docs/${name}.md`)
      for (const { name: prop, line } of declaredProps(`${dir}/index.jsx`))
        expect(
          doc.includes(`\`${prop}\``),
          `docs/${name}.md does not mention \`${prop}\`, declared at ${dir}/index.jsx:${line}`,
        ).toBe(true)
    })
  }
})

describe('cocoon.config.js', () => {
  const sources = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const p = `${dir}/${entry}`
      if (statSync(join(ROOT, p)).isDirectory()) {
        if (!['node_modules', 'explorations', 'lockups'].includes(entry))
          walk(p)
      } else if (/\.(js|jsx|mjs)$/.test(entry) && !/\.test\./.test(entry))
        sources.push(p)
    }
  }
  walk('src')
  walk('assets')
  const code = sources.map((p) => read(p)).join('\n')
  const configLine = (key) =>
    lineOf('cocoon.config.js', new RegExp(`^\\s*${key}:`))

  for (const [group, value] of Object.entries(config)) {
    it(`${group} is read by a source under src/ or assets/`, () => {
      expect(
        code.includes(`config.${group}`),
        `cocoon.config.js: \`${group}\` (line ${configLine(group)}) is read by no file under src/ or assets/; remove it or read it`,
      ).toBe(true)
    })
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // A group read as a whole (spread, indexed or iterated) covers its leaves.
      const whole = new RegExp(
        `\\.\\.\\.config\\.${group}\\b|config\\.${group}\\[|entries\\(config\\.${group}\\)|keys\\(config\\.${group}\\)`,
      ).test(code)
      for (const leaf of Object.keys(value)) {
        if (typeof value[leaf] === 'object' && !Array.isArray(value[leaf]))
          continue // cuts.vapour: read through the group
        it(`${group}.${leaf} is read`, () => {
          expect(
            whole || code.includes(`config.${group}.${leaf}`),
            `cocoon.config.js: \`${group}.${leaf}\` (line ${configLine(leaf)}) is read by no file under src/ or assets/; remove it or read it`,
          ).toBe(true)
        })
      }
    }
  }
})
