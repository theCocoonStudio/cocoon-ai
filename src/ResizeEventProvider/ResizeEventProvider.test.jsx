// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { ResizeEventContext } from './ResizeEventContext'
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

// a consumer on the raw context: subscribes its own element under `name`
const Consumer = ({ name }) => {
  const {
    subscribe,
    unsubscribe,
    subscriptions: { [name]: { size: { width, height } } = { size: {} } },
  } = useContext(ResizeEventContext)

  const ref = useRef()

  useLayoutEffect(() => {
    const element = ref.current
    subscribe(name, element)
    return () => {
      unsubscribe(name, element)
    }
  }, [name, subscribe, unsubscribe])

  return (
    <div ref={ref} data-testid={`${name}-el`}>
      <p data-testid={`${name}-width`}>{String(width)}</p>
      <p data-testid={`${name}-height`}>{String(height)}</p>
    </div>
  )
}

// two keys, one element
const TwoKeys = ({ second = true }) => {
  const { subscribe, unsubscribe, subscriptions } =
    useContext(ResizeEventContext)
  const ref = useRef()
  const [el, setEl] = useState()
  useLayoutEffect(() => setEl(ref.current), [])
  useLayoutEffect(() => {
    if (!el) return
    subscribe('a', el)
    return () => unsubscribe('a', el)
  }, [el, subscribe, unsubscribe])
  useLayoutEffect(() => {
    if (!el || !second) return
    subscribe('b', el)
    return () => unsubscribe('b', el)
  }, [el, second, subscribe, unsubscribe])
  return (
    <div ref={ref} data-testid='two'>
      <p data-testid='a'>{String(subscriptions.a?.size.width)}</p>
      <p data-testid='b'>{String(subscriptions.b?.size.width)}</p>
      <p data-testid='keys'>{Object.keys(subscriptions).join(',')}</p>
    </div>
  )
}

beforeEach(() => {
  _subscriptions = []
})
afterEach(() => {
  cleanup()
})

describe('subscriptions', () => {
  it('effects.1 a single consumer is observed and receives its size', () => {
    expect(_subscriptions.length).toBe(0)
    const { unmount } = render(
      <ResizeEventProvider>
        <Consumer name='test' />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(1)
    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test-height').innerHTML).toBe('0')

    fire([entry(_subscriptions[0], 100, 10)])
    expect(screen.getByTestId('test-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test-height').innerHTML).toBe('10')

    unmount()
    expect(_subscriptions.length).toBe(0)
  })

  it('callbacks.neg.1 an entry for one element leaves the other key unchanged', () => {
    render(
      <ResizeEventProvider>
        <Consumer name='test' />
        <Consumer name='test2' />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(2)
    fire([entry(_subscriptions[1], 100, 10)])
    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('10')
  })

  it('callbacks.1 one tick with two entries updates both keys', () => {
    render(
      <ResizeEventProvider>
        <Consumer name='test' />
        <Consumer name='test2' />
      </ResizeEventProvider>,
    )
    fire([entry(_subscriptions[0], 100, 10), entry(_subscriptions[1], 1, 2)])
    expect(screen.getByTestId('test-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test-height').innerHTML).toBe('10')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('1')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('2')
  })

  it('effects.2 unmounting one consumer unobserves its element and keeps the other', () => {
    // keyed, so React unmounts the first consumer rather than reusing it with a new name
    const { rerender } = render(
      <ResizeEventProvider>
        <Consumer key='test' name='test' />
        <Consumer key='test2' name='test2' />
      </ResizeEventProvider>,
    )
    const gone = screen.getByTestId('test-el')
    rerender(
      <ResizeEventProvider>
        <Consumer key='test2' name='test2' />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.includes(gone)).toBe(false)
    expect(_subscriptions.length).toBe(1)
    fire([entry(_subscriptions[0], 7, 8)])
    expect(screen.getByTestId('test2-width').innerHTML).toBe('7')
  })

  it('effects.3 unmounting the provider disconnects the observer', () => {
    const { unmount } = render(
      <ResizeEventProvider>
        <Consumer name='test' />
      </ResizeEventProvider>,
    )
    expect(_observer).not.toBeNull()
    unmount()
    expect(_observer).toBeNull()
    expect(_subscriptions.length).toBe(0)
  })
})

describe('many keys on one element', () => {
  it('callbacks.1 two keys on one element both receive updates', () => {
    render(
      <ResizeEventProvider>
        <TwoKeys />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(1)
    fire([entry(screen.getByTestId('two'), 5, 5)])
    expect(screen.getByTestId('a').innerHTML).toBe('5')
    expect(screen.getByTestId('b').innerHTML).toBe('5')
    expect(screen.getByTestId('keys').innerHTML).toBe('a,b')
  })

  it('effects.2 removing one key keeps the element observed for the other; the last key unobserves', () => {
    const { rerender } = render(
      <ResizeEventProvider>
        <TwoKeys />
      </ResizeEventProvider>,
    )
    const el = screen.getByTestId('two')
    rerender(
      <ResizeEventProvider>
        <TwoKeys second={false} />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.includes(el)).toBe(true)
    fire([entry(el, 6, 6)])
    expect(screen.getByTestId('a').innerHTML).toBe('6')
    expect(screen.getByTestId('keys').innerHTML).toBe('a')
  })
})

describe('exits', () => {
  it('exits.throws subscribe with a non-element throws, and is ignored with quiet', () => {
    const Bad = () => {
      const { subscribe } = useContext(ResizeEventContext)
      useLayoutEffect(() => {
        subscribe('bad', null)
      }, [subscribe])
      return null
    }
    expect(() =>
      render(
        <ResizeEventProvider>
          <Bad />
        </ResizeEventProvider>,
      ),
    ).toThrow('subscribe expects a valid element or query selector')
    cleanup()
    expect(() =>
      render(
        <ResizeEventProvider quiet>
          <Bad />
        </ResizeEventProvider>,
      ),
    ).not.toThrow()
    expect(_subscriptions.length).toBe(0)
  })

  it('effects.1 a selector string resolves to its element', () => {
    const BySelector = () => {
      const { subscribe, subscriptions } = useContext(ResizeEventContext)
      useLayoutEffect(() => {
        subscribe('sel', '#target')
      }, [subscribe])
      return <p data-testid='sel'>{String(subscriptions.sel?.size.width)}</p>
    }
    render(
      <ResizeEventProvider>
        <div id='target' />
        <BySelector />
      </ResizeEventProvider>,
    )
    expect(_subscriptions.length).toBe(1)
    fire([entry(_subscriptions[0], 3, 3)])
    expect(screen.getByTestId('sel').innerHTML).toBe('3')
  })

  it('exits.throws an entry with no keys throws while debugMode is on and is dropped otherwise', () => {
    const debug = { current: false }
    render(
      <ResizeEventProvider debugMode={debug}>
        <Consumer name='test' />
      </ResizeEventProvider>,
    )
    const stray = document.createElement('div')
    expect(() => fire([entry(stray, 1, 1)])).not.toThrow()
    debug.current = true
    expect(() => fire([entry(stray, 1, 1)])).toThrow(
      'an observer entry is not associated with a subscriptions key',
    )
  })
})
