import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from '../cocoon.config.js'
import { FIELDS, LISTS, parseFrontMatter } from '../scripts/manifest.mjs'

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

describe('no conflict markers', () => {
  // A merge conflict resolved by hand can leave its markers behind, and inside
  // a fenced block in a Markdown file neither prettier nor the linter objects:
  // README.md shipped with four marker lines in its Layout block on 2026-10-07
  // (PR #64). Every text file in the repo is read; a marker line fails here.
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      if (['node_modules', 'dist', '.git'].includes(entry)) continue
      const p = dir ? `${dir}/${entry}` : entry
      if (statSync(join(ROOT, p)).isDirectory()) walk(p)
      else if (/\.(js|jsx|mjs|md|json|yml|yaml|sh|css|html|txt)$/.test(entry))
        files.push(p)
    }
  }
  walk('')
  it('no tracked text file holds a conflict marker line', () => {
    const marker = /^(<{7}|={7}|>{7})( |$)/
    for (const p of files) {
      const at = lines(p).findIndex((l) => marker.test(l))
      expect(
        at,
        `${p}:${at + 1} is a conflict marker line; resolve the conflict and remove the markers`,
      ).toBe(-1)
    }
  })
})

describe('the record and the npm config stay out of this public repository', () => {
  // Nothing in the setup refused a record on a public repository until 2026-10-19 (the
  // audit's item 7; a private session reached a public branch of another repository on
  // 2026-10-17). A tracked path under records/, chat/ or exports/, a chat export
  // (export-claude.md, export-gemini.md) or a session export by its date-and-id name fails here; so does a tracked .npmrc, which npm reads over the user's
  // config and would switch install scripts back on at the sandbox's start (the audit's
  // item 2). The records-guard workflow refuses the same at the push, on every branch.
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT })
    .toString()
    .split('\n')
    .filter(Boolean)
  it('no tracked path is a record of a session or a chat', () => {
    const hits = tracked.filter(
      (p) =>
        /^(records|chat|exports)\//.test(p) ||
        /(^|\/)export-(claude|gemini)\.md$/.test(p) ||
        /(^|\/)\d{4}-\d{2}-\d{2}-session-[0-9a-f]{8}\.(md|jsonl)$/.test(p),
    )
    expect(
      hits,
      `records belong to the private records repository, never here: ${hits.join(', ')}`,
    ).toEqual([])
  })
  it('no tracked .npmrc', () => {
    const hits = tracked.filter((p) => /(^|\/)\.npmrc$/.test(p))
    expect(
      hits,
      "a project .npmrc outranks the sandbox's ignore-scripts; the image's npm config is the one source",
    ).toEqual([])
  })
})

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

describe('docs', () => {
  // What ships to a consumer that renders the docs itself (src/manifest.spec.md,
  // docs.2 to docs.5): every component doc opens with the front matter the
  // manifest reads, the body is CommonMark with no raw HTML outside code, and
  // every relative image is beside the doc. The checks are text only; the
  // manifest's own checks, which import the module, are src/manifest.test.js.
  const components = readdirSync(join(ROOT, 'src')).filter(
    (d) =>
      d !== 'utils' &&
      d !== 'test' &&
      statSync(join(ROOT, 'src', d)).isDirectory(),
  )
  const docs = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const p = `${dir}/${entry}`
      if (statSync(join(ROOT, p)).isDirectory()) walk(p)
      else if (entry.endsWith('.md')) docs.push(p)
    }
  }
  walk('docs')

  for (const name of components) {
    it(`docs.2 docs/${name}.md opens with the front matter: ${FIELDS.join(', ')}`, () => {
      const doc = `docs/${name}.md`
      let data
      expect(() => ({ data } = parseFrontMatter(read(doc), doc))).not.toThrow()
      for (const field of FIELDS) {
        expect(
          field in data,
          `${doc}: the front matter has no ${field}; the fields are ${FIELDS.join(', ')}`,
        ).toBe(true)
        expect(
          Array.isArray(data[field]),
          `${doc}: ${field} must be ${LISTS.has(field) ? 'a list' : 'a string'}`,
        ).toBe(LISTS.has(field))
      }
      expect(
        data.since,
        `${doc}: since must be a date, YYYY-MM-DD, the day the component first shipped`,
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const field of ['title', 'summary'])
        expect(data[field].length, `${doc}: ${field} is empty`).toBeGreaterThan(
          0,
        )
      expect(data.credits.length, `${doc}: credits is empty`).toBeGreaterThan(0)
    })
  }

  /** The doc's lines with fenced blocks and inline code blanked, so a check reads prose only. */
  const prose = (p) => {
    let fenced = false
    return lines(p).map((l) => {
      if (/^\s*(```|~~~)/.test(l)) {
        fenced = !fenced
        return ''
      }
      return fenced ? '' : l.replace(/`[^`]*`/g, '')
    })
  }

  for (const p of docs) {
    it(`docs.3 ${p} has no raw HTML outside code`, () => {
      // a tag: a name, then attributes, a slash or the close; an autolink <https://…> has a colon there
      const tag = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/
      const at = prose(p).findIndex((l) => tag.test(l))
      expect(
        at,
        `${p}:${at + 1} holds an HTML tag outside a code span or block; the body is CommonMark, so one renderer covers every doc`,
      ).toBe(-1)
    })
    it(`docs.4 ${p} references only images that exist beside it`, () => {
      const dir = p.slice(0, p.lastIndexOf('/'))
      prose(p).forEach((l, i) => {
        for (const m of l.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
          if (/^[a-z]+:/.test(m[1])) continue
          expect(
            existsSync(join(ROOT, dir, m[1])),
            `${p}:${i + 1} references the image ${m[1]}, which is not under ${dir}/`,
          ).toBe(true)
        }
      })
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
