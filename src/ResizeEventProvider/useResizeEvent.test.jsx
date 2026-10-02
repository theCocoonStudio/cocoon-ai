// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const Consumer = ({ name }) => {
  const ref = useRef()
  const [el, setEl] = useState()
  useLayoutEffect(() => {
    setEl(ref.current)
  }, [])
  const { width, height } = useResizeEvent(name, el)

  return (
    <div ref={ref}>
      <p data-testid={`${name}-width`}>{width}</p>
      <p data-testid={`${name}-height`}>{height}</p>
    </div>
  )
}

afterEach(() => {
  cleanup()
})

describe('validate context', () => {
  it('single consumer', async () => {
    expect(_subscriptions.length).toBe(0)

    const { unmount } = render(
      <ResizeEventProvider>
        <Consumer name='test' />
      </ResizeEventProvider>,
    )

    expect(_subscriptions.length).toBe(1)

    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test-height').innerHTML).toBe('0')

    act(() => {
      _cb(
        [
          {
            target: _subscriptions[0],
            contentRect: { width: 3, height: 4 },
          },
        ],
        _observer,
      )
    })
    expect(screen.getByTestId('test-width').innerHTML).toBe('3')
    expect(screen.getByTestId('test-height').innerHTML).toBe('4')

    unmount()

    expect(_subscriptions.length).toBe(0)
  })
  it('multiple consumers 1', async () => {
    expect(_subscriptions.length).toBe(0)

    const { unmount } = render(
      <ResizeEventProvider>
        <Consumer name='test' />
        <Consumer name='test2' />
      </ResizeEventProvider>,
    )

    expect(_subscriptions.length).toBe(2)

    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test-height').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('0')

    act(() => {
      _cb(
        [
          {
            target: _subscriptions[0],
            contentRect: { width: 100, height: 10 },
          },
        ],
        _observer,
      )
    })
    expect(screen.getByTestId('test-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test-height').innerHTML).toBe('10')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('0')

    unmount()

    expect(_subscriptions.length).toBe(0)
  })

  it('multiple consumers 2', async () => {
    expect(_subscriptions.length).toBe(0)

    const { unmount } = render(
      <ResizeEventProvider>
        <Consumer name='test' />
        <Consumer name='test2' />
      </ResizeEventProvider>,
    )

    expect(_subscriptions.length).toBe(2)

    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test-height').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('0')

    act(() => {
      _cb(
        [
          {
            target: _subscriptions[1],
            contentRect: { width: 100, height: 10 },
          },
        ],
        _observer,
      )
    })
    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test-height').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('10')

    unmount()

    expect(_subscriptions.length).toBe(0)
  })

  it('multiple consumers 3', async () => {
    expect(_subscriptions.length).toBe(0)

    const { unmount } = render(
      <ResizeEventProvider>
        <Consumer name='test' />
        <Consumer name='test2' />
      </ResizeEventProvider>,
    )

    expect(_subscriptions.length).toBe(2)

    expect(screen.getByTestId('test-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test-height').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('0')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('0')

    act(() => {
      _cb(
        [
          {
            target: _subscriptions[0],
            contentRect: { width: 100, height: 10 },
          },
          {
            target: _subscriptions[1],
            contentRect: { width: 1, height: 2 },
          },
        ],
        _observer,
      )
    })
    expect(screen.getByTestId('test-width').innerHTML).toBe('100')
    expect(screen.getByTestId('test-height').innerHTML).toBe('10')
    expect(screen.getByTestId('test2-width').innerHTML).toBe('1')
    expect(screen.getByTestId('test2-height').innerHTML).toBe('2')

    unmount()

    expect(_subscriptions.length).toBe(0)
  })
})
