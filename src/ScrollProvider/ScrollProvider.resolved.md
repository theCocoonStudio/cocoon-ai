# ScrollProvider — resolved

Written after the code, 2026-10-02, from PR #40, its review and Izzy's answers on the PR. Izzy's intent for the whole: "a lightweight engine that anyone can build on", not a GSAP replacement; the loop and the React split are the foundation, features plug into it.

## contracts

- The loop stays out of React: scrollTop and the section offset are refs written each frame; the only state set from the loop is the active section index, once per change (state.2–4). Test: `effects.1 scrollTopRef follows the scroll without re-rendering`.
- The loop runs only while scrolling (effects.1). Derivation, replacing the five "settle frames" of the first version: the browser fires a scroll event for every frame in which the scroll position changed, and that event restarts a stopped loop, so a frame without movement is the end, not a pause. The first frame after an event always runs, so a single discrete scroll (one wheel tick) costs one frame and still updates the refs and features. No settle count, nothing to configure. Test: `effects.1 the loop stops on the first frame without movement`, `effects.1 a scroll event restarts a stopped loop`.
- `eps` defaults to one device pixel, `1 / devicePixelRatio`, resolved on the client in the loop, never during render (props.1; Izzy on #40: "eps default should be based on dpr"). A change smaller than one device pixel is not visible, so it is not scrolling. Test: `props.1 eps defaults to one device pixel`.
- The sections feature is a plain class with pure statics, updated from the layout effect and read from the loop (state.5). Mounting with `toggleFeatureSections` tracks the section (review round one found it threw on construction). Test: `props.2 mounts with the toggle on and tracks the section`.
- The section container contract is the API's: statically positioned, no margin, no border. Ranges are summed from `clientHeight`, so a violation gives wrong ranges without an error. Izzy: "no margin or border by definition, im ok with that failing silently". Documented and tested (tier ④ of the spec skill), not checked at runtime.
- `toggleFeatureAnimations` is reserved and toggles nothing (props.3; Izzy on #40, item 6: "that's fine for now"). The doc says so; `AnimationFeature` is exported for use by hand.
- The loop is cancelled on unmount through a ref the next frame reads (effects.3; Izzy's point 9 on #40). Test: `effects.3 no frame runs after unmount`.
- The provider renders on the server: nothing touches `window`, `document` or `ResizeObserver` during render; the wrapped `ResizeEventProvider` creates its observer on the first subscription. Test: `ssr: ScrollProvider renders on the server`.
- The same contracts hold in a real browser: `ScrollProvider.browser.test.js` drives the page `ScrollProvider.browser-entry.jsx` through headless Chromium with real scrolling, real frames and a real `ResizeObserver` (the loop stops when scrolling stops; a resize of the sections re-runs the features at the same scrollTop). Skipped where no Chromium is, as the fluid tests are.

## defaults

- `eps`: undefined, resolved to `1 / (window.devicePixelRatio || 1)` CSS pixels on the client.
- `toggleFeatureSections`, `toggleFeatureAnimations`: false.
- `containerProps`: `{}`.
- `activeSectionIndex`: 0; the refs: 0.

## notes

- A resize of the static container (through `useResizeEvent('_internalKey', ...)`) re-runs the layout effect: the sections feature is updated with the new heights and the loop runs once, so the refs and the index reflect the new layout without a scroll.
- `initialLayoutReady` exists for children that render after the wrapper (async, suspense): it re-reads the wrapper's first child as the scroll element.
- The design assumes an inner scroll container; a window-scroll mode is not provided. Raised in review as cheap now and awkward later; Izzy deferred it.
- Ranges from DOM offsets (`offsetTop`) instead of summed heights would remove the margin/border contract entirely (tier ① of the spec skill). Izzy considered and deferred it: "is it worth a commit right now? ... wasn't urgent enough". Left as a gap.

## gaps

- Window scrolling: not supported; the scroll element must be an element.
- Section ranges by offsets rather than summed heights: deferred, see notes.
- `toggleFeatureAnimations`: reserved, not wired.
