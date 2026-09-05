#!/usr/bin/env node
/**
 * Render every icon in SET and refuse to ship it if it is wrong.
 *
 *   node assets/icons/build.js [outdir]
 *
 * Writes icon-<name>.svg (viewBox = the ink's own box) and
 * icon-<name>-square.svg (square, ink centred on the shorter axis) per icon,
 * plus preview.html, a self-contained contact sheet. Every fill is
 * currentColor. The haze is not in the files; it is the constraint the shapes
 * are chosen against, and the first guard keeps that claim honest.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as H from '../lib/haze.js'
import { NOTES, SET } from './shapes.js'
import { HEAD, TAIL } from './specimen.js'
import { runGuards } from './guards.js'

const here = dirname(fileURLToPath(import.meta.url))

/** Every shipped file for the set: name -> text. */
export function renderSet(set = SET) {
  const files = {}
  for (const [name, [fn, opts]] of Object.entries(set))
    for (const { name: file, text } of H.emit(`icon-${name}`, fn(), opts))
      files[file] = text
  return files
}

/** The contact sheet as one self-contained HTML document. */
export function contactSheet(set = SET, notes = NOTES) {
  const f4 = (vb) => vb.map((v) => v.toFixed(3)).join(' ')
  const flat = (paths) => paths.map(({ d, evenodd }) => [d, evenodd ? 1 : 0])
  const icons = {}
  const haze = {}
  for (const [name, [fn, opts]] of Object.entries(set)) {
    const shape = fn()
    const entry = {}
    for (const [key, square] of [
      ['t', false],
      ['s', true],
    ]) {
      const { pieces, viewBox } = H.front(shape, { square, ...opts })
      entry[key] = [f4(viewBox), flat(pieces[0].paths)]
    }
    icons[name] = entry
    const { pieces, bounds } = H.build(shape, { cut: 'vapour', ...opts })
    haze[name] = { vb: f4(bounds), planes: pieces.map((p) => flat(p.paths)) }
  }
  const pal = {}
  for (const cut of ['vapour', 'dense'])
    for (const rev of [false, true])
      pal[cut + (rev ? '-reversed' : '')] = Array.from(
        { length: H.N },
        (_, k) => H.tone(k, cut, rev),
      )
  const j = JSON.stringify
  return (
    HEAD +
    `<script>\nconst ICONS=${j(icons)};\nconst HAZE=${j(haze)};\nconst PAL=${j(pal)};\nconst NOTES=${j(notes)};\n</script>\n` +
    TAIL
  )
}

export function build(out = here) {
  mkdirSync(out, { recursive: true })
  const files = renderSet()
  for (const [name, text] of Object.entries(files))
    writeFileSync(join(out, name), text)
  writeFileSync(join(out, 'preview.html'), contactSheet())
  const { ledger, rows, squareAlready } = runGuards(SET, files)
  ledger.push([
    'not run',
    'guards proven capable of failing',
    'npm test  - assets/icons/icons.test.js feeds each guard its defect',
  ])
  ledger.push([
    'not run',
    'raster: the shipped files, not the model',
    'npm run assets:raster  - renders every file and measures the ink',
  ])
  ledger.push([
    'not run',
    'logo regression through the same engine',
    'npm test  - assets/logo/logo.test.js',
  ])
  return { files, ledger, rows, squareAlready }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || here
  const { files, ledger, rows, squareAlready } = build(out)
  console.log(`${Object.keys(files).length} svg files + preview.html in ${out}`)
  console.log(
    `tight == square (ink already square): ${squareAlready.join(', ')}`,
  )
  console.log(
    `non-square tight boxes: ${rows
      .filter((r) => Math.abs(r.w - r.h) > 1)
      .map((r) => `${r.name} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`)
      .join(', ')}`,
  )
  console.log()
  for (const [status, what, detail] of ledger)
    console.log(`  ${status.padEnd(8)} ${what.padEnd(44)} ${detail}`)
}
