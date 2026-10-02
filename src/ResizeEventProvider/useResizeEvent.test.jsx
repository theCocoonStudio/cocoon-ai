// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useResizeEvent } from './useResizeEvent'
import { ResizeEventProvider } from './ResizeEventProvider'

let _cb, _observer
let _subscriptions = []

class ResizeObserverMock {
  constructor(cb) {
    _cb = cb
    _observer = this
  }
  observe(el) {
    if (!_subscriptions.includes(el)) {
      _subscriptions.push(el)
    }
  }
  unobserve(el) {
    _subscriptions = [..._subscriptions.filter((_el) => _el !== el)]
  }
  disconnect() {
    _cb = null
    _observer = null
    _subscriptions = []
  }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

const fire = (entries) => act(() => _cb(entries, _observer))
const entry = (target, width, height) => ({
  target,
  contentRect: { width, height },
})

// the documented form: the element held in state, set from the ref in a layout effect
const Owner = ({ name }) => {
  const ref = useRef()
  const [el, setEl] = useState()
  useLayoutEffect(() => {
    setEl(ref.current)
  }, [])
  const { width, height } = useResizeEvent(name, el)

  return (
    <div ref={ref} data-testid={`${name}-el`}>
      <p data-testid={`${name}-width`}>{String(width)}</p>
      <p data-testid={`${name}-height`}>{String(height)}</p>
    </div>
  )
}

// the documented second form: no element, reads another component's key
const Reader = ({ name }) => {
  const { width } = useResizeEvent(name)
  return <p data-testid={`${name}-reader`}>{String(width)}</p>
}

beforeEach(() => {
  _subscriptions = []
})
afterEach(() => {
  cleanup()
})

describe('context.hook.1', () => {
  it('context.hook.1 the doc example subscribes and receives its size', () => {
    const { unmount } = render(
      <ResizeEventProvider>
        <Owner name='test' />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(1)
    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    fire([entry(_subscriptions[0], 3, 4)])
    expect(screen.getByTestId('test-width').innerHTML).toBe('3')
    expect(screen.getByTestId('test-height').innerHTML).toBe('4')
    unmount()
    expect(_subscriptions.length).toBe(0)
  })

  it('callbacks.neg.1 two owners: an entry for one leaves the other at its value', () => {
    render(
      <ResizeEventProvider>
        <Owner name='test' />
        <Owner name='test2' />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(2)
    fire([entry(_subscriptions[0], 100, 10)])
    expect(screen.getByTestId('test-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('0')
    fire([entry(_subscriptions[1], 1, 2)])
    expect(screen.getByTestId('test-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('1')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('2')
  })

  it('context.hook.1 a reader sees the size registered under the key', () => {
    render(
      <ResizeEventProvider>
        <Owner name='k' />
        <Reader name='k' />
      </ResizeEventProvider>,
    )
    expect(screen.getByTestId('k-reader').innerHTML).toBe('0')
    fire([entry(screen.getByTestId('k-el'), 9, 9)])
    expect(screen.getByTestId('k-reader').innerHTML).toBe('9')
  })

  it('context.hook.1 a reader of an unregistered key gets undefined', () => {
    render(
      <ResizeEventProvider>
        <Reader name='nobody' />
      </ResizeEventProvider>,
    )
    expect(screen.getByTestId('nobody-reader').innerHTML).toBe('undefined')
    expect(_subscriptions.length).toBe(0)
  })

  it('effects.4 a reader unmounting leaves the owner subscription intact', () => {
    const { rerender } = render(
      <ResizeEventProvider>
        <Owner name='k' />
        <Reader name='k' />
      </ResizeEventProvider>,
    )
    const el = screen.getByTestId('k-el')
    fire([entry(el, 9, 9)])
    expect(screen.getByTestId('k-width').innerHTML).toBe('9')
    rerender(
      <ResizeEventProvider>
        <Owner name='k' />
      </ResizeEventProvider>,
    )
    expect(screen.getByTestId('k-width').innerHTML).toBe('9')
    expect(_subscriptions.includes(el)).toBe(true)
    fire([entry(el, 11, 11)])
    expect(screen.getByTestId('k-width').innerHTML).toBe('11')
  })

  it('effects.4 a changed key moves the subscription', () => {
    const Movable = ({ name }) => {
      const ref = useRef()
      const [el, setEl] = useState()
      useLayoutEffect(() => {
        setEl(ref.current)
      }, [])
      const { width } = useResizeEvent(name, el)
      return (
        <div ref={ref} data-testid='movable'>
          {String(width)}
        </div>
      )
    }
    const { rerender } = render(
      <ResizeEventProvider>
        <Movable name='first' />
        <Reader name='first' />
        <Reader name='second' />
      </ResizeEventProvider>,
    )
    const el = screen.getByTestId('movable')
    rerender(
      <ResizeEventProvider>
        <Movable name='second' />
        <Reader name='first' />
        <Reader name='second' />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(1)
    fire([entry(el, 4, 4)])
    expect(screen.getByTestId('second-reader').innerHTML).toBe('4')
    expect(screen.getByTestId('first-reader').innerHTML).toBe('undefined')
  })
})
