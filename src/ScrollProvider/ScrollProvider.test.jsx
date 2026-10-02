// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import { act, cleanup, render, screen } from '@testing-library/react'
import { createRef, useEffect } from 'react'
import { ScrollProvider } from './ScrollProvider'
import { useScroll } from './useScroll'

// ResizeObserver mock: records the observed elements and keeps the callback
let _observerCallback = null
let _subscriptions = []

class ResizeObserverMock {
  constructor(callback) {
    _observerCallback = callback
  }
  observe(el) {
    if (!_subscriptions.includes(el)) {
      _subscriptions.push(el)
    }
  }
  unobserve(el) {
    _subscriptions = _subscriptions.filter((_el) => _el !== el)
  }
  disconnect() {
    _subscriptions = []
    _observerCallback = null
  }
}
globalThis.ResizeObserver = ResizeObserverMock

// requestAnimationFrame mock: frames run from a queue, one batch per tick(), so a
// test can count them and move the scroll position between them
let frames = []
let frameCount = 0
globalThis.requestAnimationFrame = (callback) => {
  frames.push(callback)
  return frames.length
}
globalThis.cancelAnimationFrame = () => {}
const tick = async () =>
  act(async () => {
    const batch = frames
    frames = []
    for (const cb of batch) {
      frameCount += 1
      cb(performance.now())
    }
  })
const settle = async (max = 20) => {
  for (let i = 0; i < max && frames.length; i += 1) await tick()
}

// element metrics: the scroll element 50 high with 150 of content, three sections of 50
let currentScrollTop = 0
const originalCreateElement = document.createElement.bind(document)
const withMetrics = (tagName, options) => {
  const el = originalCreateElement(tagName, options)
  const def = (k, v) =>
    Object.defineProperty(el, k, { configurable: true, value: v })
  if (tagName === 'div') {
    def('clientHeight', 50)
    def('scrollHeight', 150)
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => currentScrollTop,
      set: (val) => {
        currentScrollTop = val
      },
    })
  }
  if (tagName === 'main') def('clientHeight', 150)
  if (tagName === 'section') def('clientHeight', 50)
  return el
}

// a module-level object records the context and the commit count; not a prop,
// since the compiler rules forbid writing through props
let sink
const Consumer = () => {
  const context = useScroll()
  // recorded after each commit, never during render
  useEffect(() => {
    sink.renders += 1
    sink.context = context
  })
  // renders nothing: the provider's first child must be the scroll element
  return null
}

const Page = ({ providerRef, ...props }) => (
  <ScrollProvider ref={providerRef} {...props}>
    <Consumer />
    <div data-testid='scroll' style={{ height: '50px', overflow: 'scroll' }}>
      <main style={{ height: '150px' }}>
        <section style={{ height: '50px' }} />
        <section style={{ height: '50px' }} />
        <section style={{ height: '50px' }} />
      </main>
    </div>
  </ScrollProvider>
)

const mount = async (props = {}) => {
  const providerRef = createRef()
  sink = { renders: 0, context: null }
  document.createElement = withMetrics
  try {
    await act(async () => {
      render(<Page providerRef={providerRef} {...props} />)
    })
  } finally {
    document.createElement = originalCreateElement
  }
  await settle()
  return { providerRef, sink, scroll: screen.getByTestId('scroll') }
}

const scrollTo = async (el, value) => {
  await act(async () => {
    currentScrollTop = value
    el.dispatchEvent(new Event('scroll'))
  })
}

beforeEach(() => {
  currentScrollTop = 0
  frames = []
  frameCount = 0
  _subscriptions = []
  _observerCallback = null
  window.devicePixelRatio = 1
})
afterEach(() => {
  cleanup()
  document.createElement = originalCreateElement
})

describe('effects.1 the loop', () => {
  it('effects.1 scrollTopRef follows the scroll without re-rendering', async () => {
    const { providerRef, sink, scroll } = await mount()
    expect(providerRef.current.scrollTopRef.current).toBe(0)
    const rendersBefore = sink.renders
    await scrollTo(scroll, 50)
    await settle()
    expect(providerRef.current.scrollTopRef.current).toBe(50)
    expect(sink.context.scrollTopRef.current).toBe(50)
    expect(sink.renders).toBe(rendersBefore)
  })

  it('effects.1 a single scroll event costs one frame', async () => {
    const { providerRef, scroll } = await mount()
    frameCount = 0
    await scrollTo(scroll, 20)
    await settle()
    expect(frameCount).toBe(1)
    expect(providerRef.current.scrollTopRef.current).toBe(20)
  })

  it('effects.1 the loop continues while the position moves and stops on the first still frame', async () => {
    const { providerRef, scroll } = await mount()
    frameCount = 0
    await scrollTo(scroll, 20)
    currentScrollTop = 30
    await tick() // reads 30: moved since the event, continues
    currentScrollTop = 40
    await tick() // reads 40: moved, continues
    await tick() // reads 40: still, stops
    expect(frames.length).toBe(0)
    expect(frameCount).toBe(3)
    expect(providerRef.current.scrollTopRef.current).toBe(40)
  })

  it('callbacks.neg.1 a scroll event while the loop runs starts nothing', async () => {
    const { scroll } = await mount()
    await scrollTo(scroll, 10)
    expect(frames.length).toBe(1)
    await scrollTo(scroll, 11)
    expect(frames.length).toBe(1)
    await settle()
  })

  it('effects.1 a scroll event restarts a stopped loop', async () => {
    const { providerRef, scroll } = await mount()
    await scrollTo(scroll, 10)
    await settle()
    expect(frames.length).toBe(0)
    await scrollTo(scroll, 60)
    expect(frames.length).toBe(1)
    await settle()
    expect(providerRef.current.scrollTopRef.current).toBe(60)
  })

  it('props.1 eps defaults to one device pixel', async () => {
    window.devicePixelRatio = 2
    const { providerRef, scroll } = await mount()
    await scrollTo(scroll, 10)
    currentScrollTop = 10.4 // under half a CSS pixel: not scrolling at dpr 2
    await tick()
    expect(frames.length).toBe(0)
    expect(providerRef.current.scrollTopRef.current).toBe(10.4)
    await scrollTo(scroll, 20)
    currentScrollTop = 20.6 // over half: still scrolling
    await tick()
    expect(frames.length).toBe(1)
    await settle()
  })

  it('props.1 an explicit eps replaces the derived one', async () => {
    const { scroll } = await mount({ eps: 5 })
    await scrollTo(scroll, 10)
    currentScrollTop = 14
    await tick()
    expect(frames.length).toBe(0)
    await scrollTo(scroll, 20)
    currentScrollTop = 25
    await tick()
    expect(frames.length).toBe(1)
    await settle()
  })

  it('effects.3 no frame runs after unmount', async () => {
    const { scroll } = await mount()
    await scrollTo(scroll, 10)
    currentScrollTop = 20
    expect(frames.length).toBe(1)
    cleanup()
    await tick()
    expect(frames.length).toBe(0)
  })
})

describe('props.2 sections', () => {
  it('props.2 mounts with the toggle on and tracks the section', async () => {
    const { providerRef, scroll } = await mount({
      toggleFeatureSections: true,
    })
    expect(providerRef.current._sectionFeature.activeSectionIndex).toBe(0)
    await scrollTo(scroll, 75)
    await settle()
    expect(providerRef.current._sectionFeature.activeSectionIndex).toBe(2)
  })

  it('callbacks.2 the index is state and changes once per section change; the offset is a ref', async () => {
    const { sink, scroll } = await mount({
      toggleFeatureSections: true,
    })
    const before = sink.renders
    // the first section's range is [0, 0], so any positive scrollTop is section 1
    await scrollTo(scroll, 10)
    await settle()
    expect(sink.renders).toBe(before + 1)
    await scrollTo(scroll, 30)
    await settle()
    expect(sink.renders).toBe(before + 1)
    expect(sink.context.sections.activeSectionIndex).toBe(1)
    await scrollTo(scroll, 75)
    await settle()
    expect(sink.renders).toBe(before + 2)
    expect(sink.context.sections.activeSectionIndex).toBe(2)
    expect(sink.context.sections.activeSectionOffsetRef.current).toBe(0.5)
  })

  it('effects.2 a resize of the static container re-runs the features', async () => {
    const { providerRef, scroll } = await mount({
      toggleFeatureSections: true,
    })
    await scrollTo(scroll, 75)
    await settle()
    const main = scroll.children[0]
    expect(_subscriptions.includes(main)).toBe(true)
    await act(async () => {
      _observerCallback(
        [{ target: main, contentRect: { width: 10, height: 150 } }],
        { unobserve() {} },
      )
    })
    await settle()
    expect(providerRef.current._sectionFeature.activeSectionIndex).toBe(2)
    expect(providerRef.current.scrollTopRef.current).toBe(75)
  })
})

describe('handle and context', () => {
  it('handle.1–3 the handle exposes the refs and the feature', async () => {
    const { providerRef } = await mount()
    const handle = providerRef.current
    expect(handle.scrollTopRef).toHaveProperty('current')
    expect(handle._containerRef.current).toBeInstanceOf(HTMLDivElement)
    expect(handle._sectionFeature).toBeDefined()
  })

  it('context.provided useScroll returns the context shape', async () => {
    const { sink } = await mount()
    const context = sink.context
    expect(Object.keys(context).sort()).toEqual(
      [
        '_containerRef',
        'initialLayoutReady',
        'scrollTopRef',
        'sections',
      ].sort(),
    )
    expect(Object.keys(context.sections).sort()).toEqual(
      [
        '_sectionFeature',
        'activeSectionIndex',
        'activeSectionOffsetRef',
      ].sort(),
    )
  })

  it('markup.1 containerProps land on the wrapper div', async () => {
    const { providerRef } = await mount({
      containerProps: { 'data-testid': 'wrap', className: 'x' },
    })
    expect(screen.getByTestId('wrap')).toBe(
      providerRef.current._containerRef.current,
    )
    expect(screen.getByTestId('wrap').className).toBe('x')
  })
})
