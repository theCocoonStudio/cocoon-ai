// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SectionFeature } from './SectionFeature'

afterEach(() => {
  cleanup()
})

describe('satic methods', () => {
  it('getSectionData', () => {
    render(
      <div data-testid='test'>
        <div>
          <div />
          <div />
          <div />
        </div>
      </div>,
    )

    const element = screen.getByTestId('test')

    Object.defineProperty(element, 'clientHeight', {
      configurable: true,
      value: 50,
    })

    Object.defineProperty(element, 'scrollHeight', {
      configurable: true,
      value: 150,
    })

    Object.defineProperty(element.children[0], 'clientHeight', {
      configurable: true,
      value: 150,
    })
    Object.defineProperty(element.children[0].children[0], 'clientHeight', {
      configurable: true,
      value: 50,
    })
    Object.defineProperty(element.children[0].children[1], 'clientHeight', {
      configurable: true,
      value: 50,
    })
    Object.defineProperty(element.children[0].children[2], 'clientHeight', {
      configurable: true,
      value: 50,
    })

    const x = SectionFeature.getSectionData(element, 150, 50)
    const [first, second, third] = x

    expect(first.min).toBe(0)
    expect(first.max).toBe(0)
    expect(first.computeSectionOffset(0)).toBe(1.0)
    expect(first.computeSectionOffset(50)).toBe(1.0)
    expect(second.min).toBe(0)
    expect(second.max).toBe(50)
    expect(second.computeSectionOffset(0)).toBe(0.0)
    expect(second.computeSectionOffset(25)).toBe(0.5)
    expect(second.computeSectionOffset(50)).toBe(1.0)
    expect(third.min).toBe(50)
    expect(third.max).toBe(100)
    expect(third.computeSectionOffset(0)).toBe(0.0)
    expect(third.computeSectionOffset(25)).toBe(0.0)
    expect(third.computeSectionOffset(50)).toBe(0.0)
    expect(third.computeSectionOffset(75)).toBe(0.5)
    expect(third.computeSectionOffset(100)).toBe(1.0)
  })
})
