# ScrollProvider

`src/ScrollProvider/index.jsx`, a context provider and a hook. The current scroll position of one scroll element, read once per frame while scrolling into a ref, plus optional features computed from it. It wraps its own `ResizeEventProvider`, so a layout change re-runs the features.

```jsx
import { ScrollProvider, useScroll } from 'cocoon-ai'

function App() {
  return (
    <ScrollProvider toggleFeatureSections>
      <div style={{ height: '100vh', overflowY: 'scroll' }}>
        <main>
          <section />
          <section />
          <section>
            <Consumer />
          </section>
        </main>
      </div>
    </ScrollProvider>
  )
}

function Consumer() {
  const { scrollTopRef, sections } = useScroll()
  /* read scrollTopRef.current in a frame loop; sections.activeSectionIndex is state */
}
```

The first child of the provider's wrapper is the scroll element. With `toggleFeatureSections`, its first child is a static container whose children are the sections: statically positioned, no margin, no border. The section ranges are computed by summing the sections' `clientHeight`, so a margin or border puts the ranges off without an error; that is the contract, not a check.

## API

### `ScrollProvider`

| prop                      | default   |                                                                                                                                                                                                                         |
| ------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`                | undefined | markup and context consumers; the first child is the scroll element; with `toggleFeatureSections`, `<div><div>[...sections]</div></div>`, the inner div and the sections statically positioned with no margin or border |
| `ref`                     | undefined | the imperative handle, below                                                                                                                                                                                            |
| `eps`                     | undefined | number, CSS pixels: the smallest change of `scrollTop` between two frames that counts as scrolling. Default one device pixel, `1 / devicePixelRatio`, resolved on the client                                            |
| `toggleFeatureSections`   | false     | boolean: track the active section and the offset within it                                                                                                                                                              |
| `toggleFeatureAnimations` | false     | boolean, reserved: the animation feature is not wired yet, so this toggles nothing                                                                                                                                      |
| `containerProps`          | {}        | object: props spread onto the div wrapping `children`; nothing is assigned internally. The div's ref is `_containerRef` in both the context and the handle                                                              |

**The loop.** A scroll event starts a `requestAnimationFrame` loop. Each frame reads `scrollTop` into `scrollTopRef`, runs the enabled features, and continues only if the position moved by at least `eps` since the previous frame. It stops on the first frame without movement: the browser fires a scroll event for every frame in which the position changed, and that event restarts the loop, so there is nothing to wait for. A resize of the static container re-runs the features and the loop once. The loop is cancelled on unmount.

**`ref` handle**:

```js
{
  scrollTopRef, // RefObject<number>: the scroll element's scrollTop, updated each frame while scrolling
  _sectionFeature, // the SectionFeature instance
  _containerRef, // RefObject<HTMLDivElement>: the wrapper div
}
```

### `useScroll`

Returns the context object:

```js
{
  scrollTopRef, // as in the handle
  _containerRef, // as in the handle
  sections: {
    activeSectionIndex, // number, React state: changes once per section change
    activeSectionOffsetRef, // RefObject<number>: 0..1 within the active section, updated each frame
    _sectionFeature, // the SectionFeature instance
  },
  initialLayoutReady, // () => void: call once the scroll element exists, when children render after the wrapper (async, suspense)
}
```

### Features

**Sections** (`toggleFeatureSections`). `SectionFeature` in `src/ScrollProvider/features/SectionFeature.js`: from the sections' heights it builds one `{ min, max }` scroll range per section. A section entirely visible at `scrollTop` 0 has the range `[0, 0]` and an offset of 1; each later section's range runs from the previous section's `max` to its own bottom edge aligned with the viewport's. `setScrollTop(value, onSectionChange)` sets the active index and offset and calls `onSectionChange(index, offset)` once per change. The static helpers and the setters are documented in the file.

**Animations** (`toggleFeatureAnimations`). Reserved. `AnimationFeature` in `src/ScrollProvider/features/AnimationFeature.js` computes a raw or clamped offset of a `scrollTop` within a `[min, max]` range and is exported for use by hand; the provider does not instantiate it yet.
