# Consuming the package

How a site takes `cocoon-ai`: the install, what the site provides to a demo, the manifest, the docs, loading, and the minimal consumer the harness proves all of it against. The contract itself, item by item, is `src/manifest.spec.md`; this page is the walk through it from the site's side.

## The install

The site depends on the package by file link, `"cocoon-ai": "file:../cocoon-ai"` today, or on a tarball from `npm pack`. Either way what arrives is what `files` in `package.json` names: `dist/` (two ES bundles, `index.js` and `demos.js`, with source maps) and `docs/`. Three import paths exist, and no other: `cocoon-ai` (the components and utilities), `cocoon-ai/demos` (the manifest, the wrapper, the demos), `cocoon-ai/package.json`.

The package bundles none of its peers. The site provides `react`, `react-dom`, `three` and `@react-three/fiber`, and `tunnel-rat` and `@pmndrs/assets` where a demo needs them (`peerDependencies`, the last two optional). A linked package resolves its peers from the tree it links into, so the site keeps one copy of each; a second copy of `react` or `three` is the first thing to look for when a scene mounts and nothing draws.

## What the site provides to a demo

- **One Canvas**, outside the page tree, fixed behind the whole site, on three's WebGPU renderer (it falls back to WebGL 2 where the browser has no WebGPU). A demo never renders a Canvas.
- **A tunnel** (`tunnel-rat`): `<t.Out />` inside the Canvas, and `t` passed to the demo as `tunnel` when its manifest entry says `scene: true`. The demo's scene goes through `tunnel.In` into the site's Canvas and places itself over its container's rectangle at the camera's depth.
- **A container** with a width and a height: the demo fills it and never sets its own height.
- **Styling**: `demoContainerClass`, `settingContainerClass`, their `style` props and `theme` (which lands as `data-theme`); the package ships no stylesheet beyond layout.
- **A loader** element, shown inside the demo's container until the scene has compiled; a site that shows one global loader ignores the slot and waits on every scene's `onReady`.
- **`onReady`** and the **`ref`**: the ref is a handle with `root` (the scene's root group, traversable with fiber or three), `materials` (every material the scene uses) and `compile()`, which compiles them against the Canvas's renderer and camera and returns a promise.

## The manifest

```js
import { demos, FluidTextureDemo } from 'cocoon-ai/demos'
```

`demos` is one frozen entry per demo: `name`, `title`, `summary`, `since`, `credits`, `tags` (the doc's front matter as data), `doc` (the doc's path in the package), `scene`, `component`, `demo`, `schema`, `effects`. A page lists or routes from it; a route that wants one demo imports it by name from the same entry, so the bundler carries that demo and what it reaches. The settings sidebar is built from `schema` by the wrapper; a site may read the schema and render its own controls instead.

## The docs

Every component's doc is in the package at `entry.doc`, CommonMark with front matter and relative images beside it, no raw HTML, no MDX. The site's build copies the package's `docs/` folder to where it serves static files and renders a body with any CommonMark renderer it chooses; the package ships none. A doc page's head (title, summary, credits, since, tags) comes from the entry, never from parsing the front matter again. The "source" link beside a doc is the file's GitHub URL, built from the package's `repository` field and `entry.doc`. A doc page and a demo page are one entry read two ways.

## Loading

No lazy loading inside the package: `component` and `demo` are direct imports, and splitting by route is the site's. Every scene compiles on load behind the site's loader; a demo calls `compile()` on mount unless the site passes `compile={false}` and compiles by hand, which the home page does in one batch over every entry's materials. The compile is asynchronous where the renderer allows it, materials are shared, never permuted per instance, and a Canvas outside the page tree keeps a compiled material compiled across routes. The fit test records each scene demo's time to ready as a budget, sized for GitHub's runner.

## The minimal consumer, and what proves it

Two browser tests in this repository stand in for the site until the site itself is checked against the package (`tests.2` in the spec):

- **The fit test** (`src/manifest.browser.test.js`) mounts a page shaped like the site's from the source tree: the Canvas, the tunnel, a theme, a loader, every entry through its demo.
- **The consumer test** (`src/manifest.consumer.test.js`) does it from the packed files. It builds the library as `npm run build` does, packs it as `npm pack` does, unpacks the tarball into a minimal consumer's `node_modules/cocoon-ai` as `npm install` would for a file link, links the peers to the repository's own install, reads every entry's doc from the package's `docs/` with the manifest's reader, writes the consumer's page, and opens it in the harness's Chromium. It asserts that the tarball ships `dist/`, every doc the manifest names and `package.json` and nothing from the source tree; that the packed manifest's data equals the source tree's; that each doc's front matter equals its entry and its body reaches the page; and that every scene demo reports ready on the consumer's `react`, `three` and `fiber` with no page error.

The consumer's page, as the test writes it, is the smallest site there is:

```jsx
import { Canvas } from '@react-three/fiber'
import tunnel from 'tunnel-rat'
import { WebGPURenderer } from 'three/webgpu'
import { demos } from 'cocoon-ai/demos'

const t = tunnel()

function Page() {
  return (
    <>
      <Canvas
        style={{ position: 'fixed', inset: 0 }}
        gl={async (props) => {
          const renderer = new WebGPURenderer(props)
          await renderer.init()
          return renderer
        }}
      >
        <t.Out />
      </Canvas>
      {demos.map((entry) => {
        const Demo = entry.demo
        return (
          <section key={entry.name}>
            <h1>{entry.title}</h1>
            <p>{entry.summary}</p>
            {/* the doc's body, read from the package's docs folder at build time, rendered as the site chooses */}
            <div style={{ width: 288, height: 160, position: 'relative' }}>
              <Demo
                {...(entry.scene ? { tunnel: t } : {})}
                theme='site'
                loader={<div className='loader'>loading</div>}
              />
            </div>
          </section>
        )
      })}
    </>
  )
}
```

## Versioning

The manifest's fields and the contracts above are the package's public interface. A change to them is a major version; the two tests are what show a minor one did not break them. The site takes the package by file link now; publication to npm is a later decision and changes nothing here.
