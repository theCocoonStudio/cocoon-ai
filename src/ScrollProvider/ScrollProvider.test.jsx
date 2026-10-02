// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import { act, cleanup, render, screen } from '@testing-library/react'
import { ScrollProvider } from './ScrollProvider'
import { createRef } from 'react'

// 1. Maintain a reference to the active callback so mutations trigger it properly
let _observerCallback = null //eslint-disable-line
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

globalThis.requestAnimationFrame = (callback) => {
  setTimeout(() => callback(performance.now()), 0)
  return 1
}
globalThis.cancelAnimationFrame = () => {}

afterEach(() => {
  cleanup()
  _subscriptions = []
  _observerCallback = null
})

describe('validate context', () => {
  it('single consumer', async () => {
    const ref = createRef()

    const TestWrapper = () => {
      return (
        <ScrollProvider ref={ref}>
          <div
            data-testid='test'
            style={{ height: '50px', overflow: 'scroll' }}
          >
            <main style={{ height: '150px' }}>
              <section style={{ height: '50px' }} />
              <section style={{ height: '50px' }} />
              <section style={{ height: '50px' }} />
            </main>
          </div>
        </ScrollProvider>
      )
    }

    let currentScrollTop = 0

    // intercept the render's element behavior using a helper descriptor mapping
    const originalCreateElement = document.createElement.bind(document)
    document.createElement = (tagName, options) => {
      const el = originalCreateElement(tagName, options)
      if (tagName === 'div') {
        Object.defineProperty(el, 'clientHeight', {
          configurable: true,
          value: 50,
        })
        Object.defineProperty(el, 'scrollHeight', {
          configurable: true,
          value: 150,
        })
        Object.defineProperty(el, 'scrollTop', {
          configurable: true,
          get: () => currentScrollTop,
          set: (val) => {
            currentScrollTop = val
          },
        })
      }
      if (tagName === 'main') {
        Object.defineProperty(el, 'clientHeight', {
          configurable: true,
          value: 150,
        })
      }
      if (tagName === 'section') {
        Object.defineProperty(el, 'clientHeight', {
          configurable: true,
          value: 150,
        })
      }
      return el
    }

    render(<TestWrapper />)

    // Restore clean DOM engine behaviors
    document.createElement = originalCreateElement

    const element = screen.getByTestId('test')
    expect(ref.current.scrollTopRef.current).toBe(0)

    await act(async () => {
      currentScrollTop = 50
      element.dispatchEvent(new Event('scroll'))
      // Allow Timeout/rAF callback cycle queue to empty completely
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(ref.current.scrollTopRef.current).toBe(50)
  })
})
