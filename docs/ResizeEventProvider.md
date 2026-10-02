# ResizeEventProvider

`src/ResizeEventProvider/index.jsx`, a context provider and hook consumer. Get declarative size (`{width: number, height: number}`) updates for subscribed elements.

```jsx
import { ResizeEventProvider, useResizeEvent } from 'cocoon-ai'

function App() {
  return (
    <ResizeEventProvider>
      <Consumer />
      <OtherConsumer />
    </ResizeEventProvider>
  )
}

function Consumer() {
  const ref = useRef()
  const { width, height } = useResizeEvent('internalKey', ref)
  const { width: externalWidth, height: externalHeight } =
    useResizeEvent('externalKey')

  return <div ref={ref} />
}
```

## API

`ResizeEventProvider` props

| prop        | default           |                                                                                                                                                     |
| ----------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`  | undefined         | consuming components                                                                                                                                |
| `debugMode` | undefined (false) | React.ref to a boolean; throws if a non-fatal yet inconsistent runtime state is detected; only the value of `ref.current` should change after mount |
| `quiet`     | false             | boolean; whether invalid subscriptions throw                                                                                                        |     |

`useResizeEvent` params

```tsx
(key: string, ref?: React.Ref<HTMLElement>) =>   { width: number, height: number }
```

If `ref` argument is passed, the hook registers the attached element under `key` for resize events and returns the element's updated width and height. In this case `key` must be unique to the component.

If `ref` is `undefined`, `key` must be an existing `key` registered elsewhere in the app. The returned width and height are those associated with the keyed element.

To modify `ref` (declaratively) after first render, change the `ref` argument, not the value of `ref.current`.
