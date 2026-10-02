# ScrollProvider

`src/ScrollProvider/index.jsx`, a context provider and hook consumer. Get updated scrollTop values and utilize optional expandable features.

```jsx
import { ScrollProvider, useScroll } from 'cocoon-ai'

function App() {
  return (
    <ScrollProvider>
      <div style={{ overflowY: 'scroll' }}>
        <div />
        <div />
        <div>
          <Consumer />
        </div>
      </div>
    </ScrollProvider>
  )
}

function Consumer() {
  const { scrollTopRef } = useResizeEvent()
  /* ... */
}
```

## API

### `ScrollProvider`

| prop                      | default   |                                                                                                                                                                                                                                               |
| ------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`                | undefined | markup and context consumers; if toggleFeatureSections=true, `<div id="div1"><div id="div2">[...sectionElements]</div></div>`, where div1 is a scroll element and div2 + children are statically-positioned elements with no margin or border |
| `ref`                     | undefined | Ref: imperative handle exposed through the ref                                                                                                                                                                                                |
| `eps`                     | 0.5       | number: floating-point tolerance threshold for tracking scroll layout changes across frames                                                                                                                                                   |     |
| `toggleFeatureSections`   | false     | boolean: feature toggle: whether section index boundary tracking is enabled                                                                                                                                                                   |     |
| `toggleFeatureAnimations` | false     | boolean: feature toggle: whether section index boundary tracking is enabled                                                                                                                                                                   |     |
| `containerProps`          | {}        | object: props to apply to the div container wrapping props.children. No props are assigned internally. A direct ref is available in both the context and the handle (_containerRef)                                                           |     |

**`ref` handle**:

```js
{
  _containerRef, // ref to the div wrapper
  scrollTopRef // current scroll element scroll value, updated each frame scroll changes
  sections: { // feature data
    _sectionFeature,
    activeSectionIndex,
    activeSectionOffsetRef,
  },
  initialLayoutReady // a function to invoke once initial layout is ready, in cases where the div wrapper's first render occurs before the children are ready
}
```

### `useScroll`

Currently, this is just a convenience hook.

**context object**:

```js
{
  _containerRef: container, // ref to the div wrapper
  scrollTopRef: currentScrollTopRef, // current scroll element scroll value, updated each frame scroll changes
  _sectionFeature: sectionFeature, // feature data
}
```

### Features

To be completed retroactively by Claude and updated as these aggregate.
