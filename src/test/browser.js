/**
 * A browser for tests: bundle an entry with vite, inline it into one page,
 * open it in a headless Chromium through puppeteer-core, and hand back
 * `evaluate`. What the test renderer cannot do, draw, this can: the page
 * has WebGL 2 through SwiftShader, so a shader's output is a pixel a test
 * can read.
 *
 * Skips are the caller's: `findBrowser()` is null where no Chromium is, and
 * a test file does `it.skipIf(!browser)`. The sandbox image and GitHub's
 * runners both have one.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Where a Chromium usually is, tried after COCOON_BROWSER. */
const BROWSERS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

/** The Chromium to use, or null. */
export function findBrowser(given) {
  for (const p of [given, process.env.COCOON_BROWSER, ...BROWSERS])
    if (p && existsSync(p)) return p
  return null
}

/** Flags that give a headless Chromium WebGL 2 without a GPU, in a container. */
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--hide-scrollbars',
]

/**
 * Bundle one entry module into a single ES module string with vite: React,
 * fiber, three and the repo's own imports (`?raw` included) all inlined,
 * production mode, unminified so a stack trace still names things.
 */
async function bundle(entry) {
  const { build } = await import('vite')
  // No React plugin: under vitest NODE_ENV is "test", which makes the plugin
  // emit the dev JSX runtime against a production React. esbuild's automatic
  // runtime with jsxDev off is what a production build does.
  const result = await build({
    configFile: false,
    root: resolve(import.meta.dirname, '..', '..'),
    mode: 'production',
    logLevel: 'silent',
    esbuild: { jsx: 'automatic', jsxDev: false },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: false,
      sourcemap: false,
      lib: {
        entry: resolve(entry),
        formats: ['es'],
        fileName: () => 'page.js',
      },
      rollupOptions: { external: [] },
    },
  })
  const out = Array.isArray(result) ? result[0] : result
  return out.output[0].code
}

/** A page holding one canvas of the given size and the bundled module. */
function pageHtml(js, { width = 128, height = 128 } = {}) {
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>test</title>
<style>html,body{margin:0;background:#fff}#root{width:${width}px;height:${height}px}</style>
<body><div id="root"></div>
<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</script>
</body></html>
`
}

/**
 * Bundle `entry`, open it in Chromium, wait for `window.__ready`, and return
 * { evaluate, reload, close }. `evaluate(fn, ...args)` runs in the page.
 * `reload(init, ...args)` reopens the page with `init(...args)` run before
 * any script, for a fresh mount under different options. Every init given
 * so far runs again on each reload, in order, so later ones override.
 */
export async function openPage(entry, { width, height, browser } = {}) {
  const executable = findBrowser(browser)
  if (!executable) throw new Error('no Chromium found; see src/test/browser.js')
  const js = await bundle(entry)
  const dir = mkdtempSync(join(tmpdir(), 'cocoon-browser-'))
  const file = join(dir, 'page.html')
  writeFileSync(file, pageHtml(js, { width, height }))
  const { default: puppeteer } = await import('puppeteer-core')
  const chrome = await puppeteer.launch({
    executablePath: executable,
    headless: true,
    args: LAUNCH_ARGS,
  })
  const page = await chrome.newPage()
  await page.setViewport({
    width: width ?? 128,
    height: height ?? 128,
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  const open = async (init, ...args) => {
    if (init) await page.evaluateOnNewDocument(init, ...args)
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
    await page.waitForFunction('window.__ready === true', { timeout: 60_000 })
  }
  await open()
  return {
    page,
    errors,
    evaluate: (fn, ...args) => page.evaluate(fn, ...args),
    reload: open,
    close: async () => {
      await chrome.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
