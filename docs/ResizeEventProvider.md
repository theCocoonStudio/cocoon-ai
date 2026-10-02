# ResizeEventProvider

`src/ResizeEventProvider/index.jsx`, a context provider and a hook. Declarative size updates (`{ width, height }`) for subscribed elements, from one `ResizeObserver` shared by every subscriber under the provider.

```jsx
import { useLayoutEffect, useRef, useState } from 'react'
import { ResizeEventProvider, useResizeEvent } from 'cocoon-ai'

function App() {
  return (
    <ResizeEventProvider>
      <Panel />
      <Readout />
    </ResizeEventProvider>
  )
}

function Panel() {
  const ref = useRef()
  const [element, setElement] = useState()
  useLayoutEffect(() => setElement(ref.current), [])
  const { width, height } = useResizeEvent('panel', element)
  return <div ref={ref}>{`${width} × ${height}`}</div>
}

function Readout() {
  // no element: reads the size registered under 'panel' by Panel
  const { width } = useResizeEvent('panel')
  return <p>{width}</p>
}
```

## API

`ResizeEventProvider` props

| prop        | default   |                                                                                                                                                                                                                |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`  | undefined | consuming components                                                                                                                                                                                           |
| `debugMode` | undefined | a React ref to a boolean; while `ref.current` is true, an observer entry with no subscription throws instead of being dropped. A ref because the observer callback is created once and reads the current value |
| `quiet`     | false     | boolean; whether an invalid subscription (not an element, not a matching selector) is ignored instead of throwing                                                                                              |

`useResizeEvent` params

```ts
(key: string, element?: HTMLElement) => { width?: number, height?: number }
```

With `element`, the hook subscribes that element under `key` and returns its size, first from `clientWidth`/`clientHeight` at subscription, then from the observer on every resize. The argument is an element, not a ref: hold the element in state and set it from the ref in a layout effect, as above, so the subscription follows the node. A changed `element` or `key` moves the subscription; unmounting removes it.

Without `element`, the hook reads the size registered under `key` by another component. A reader never removes the owner's subscription when it unmounts. Both values are `undefined` until a subscription under `key` exists.

Several keys may subscribe one element, and each receives every update. A key names one element at a time: subscribing a key again replaces its element.

The observer is created on the first subscription, never during render, so the provider renders on the server. The observer is disconnected when the provider unmounts.
