# ResizeEventProvider — resolved

Written after the code, 2026-10-02, from PR #40 and its review; the decisions below are Izzy's answers on the PR and the review's findings, each with the test that holds it.

## contracts

- One observer for every subscriber under the provider; a subscriber never creates one (state.3). Test: `effects.1 observes on the first key only`.
- The observer is created on the first subscription, never during render, so the provider renders under `react-dom/server` (state.3, review finding 4, "canonical fix" per Izzy). Test: `ssr: ResizeEventProvider renders on the server`.
- An element can carry several keys and every key receives every update (callbacks.1, Izzy on #40: "the key joining allows non unique key element mapping, more general"; the code holds a Set per element rather than a joined string, so a key may contain any character). Test: `callbacks.1 two keys on one element both receive updates`.
- A key names one element at a time; subscribing the key again replaces its element in `subscriptions` (state.1).
- `useResizeEvent(key, element)` takes an element, not a ref: the code is the source of truth and the doc follows (Izzy on #40, item 3). The doc example holds the element in state set from the ref in a layout effect. Test: `context.hook.1 the doc example subscribes`.
- A reader (`useResizeEvent(key)` without an element) never removes the owner's subscription when it unmounts (effects.4, review finding 6). Test: `effects.4 a reader unmounting leaves the owner subscription intact`.
- Unsubscribing the last key of an element unobserves it (effects.2, review finding 5). Izzy accepted the earlier behaviour, the observer dropping a keyless element on its next tick; the unobserve is done anyway because it is one line and makes the state exact. Test: `effects.2 the last key unobserves the element`.
- `debugMode` is a ref (props.1): the observer callback is created once, so a plain boolean would be stale; Izzy on #40, item "debugMode ref is needed because the callback doesnt update". The callback reads it through a local ref so no ref read is a memo dependency. Test: `exits.throws debugMode throws on an entry with no keys`.

## defaults

- `quiet`: false. An invalid subscription throws, naming the expectation.
- `debugMode`: undefined, read as false.
- The initial size at subscription is `clientWidth` × `clientHeight`; the observer's `contentRect` replaces it on the first callback. Under jsdom both are 0, which the tests assert as the initial render.

## notes

- `subscriptions` is React state, so every observer tick re-renders the provider's consumers that read the context; the hook memoises its `{ width, height }` so a consumer re-renders only when its own size changes.
- `unsubscribe(key, element)` takes the element so the key can be removed from that element's set without a lookup through `subscriptions`, which may already hold a different element under the same key.

## gaps

- A key subscribed under two elements at once is not supported: the second subscription replaces the first in `subscriptions`, but the first element keeps the key in its set until it unsubscribes. Documented; a test asserts the replacement, not the leftover.
- No test under a real `ResizeObserver`; every test drives a mock's callback. The browser harness in `src/test/` could host one when a layout-dependent consumer needs it.
