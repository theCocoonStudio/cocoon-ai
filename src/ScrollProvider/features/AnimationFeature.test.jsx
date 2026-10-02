// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { AnimationFeature } from './AnimationFeature'

afterEach(() => {
  cleanup()
})

describe('static methods', () => {
  it('getOffset', () => {
    expect(AnimationFeature.getOffset(-20, 0, 10)).toBe(-2.0)
    expect(AnimationFeature.getOffset(-10, 0, 10)).toBe(-1.0)
    expect(AnimationFeature.getOffset(0, 0, 10)).toBe(0.0)
    expect(AnimationFeature.getOffset(10, 0, 10)).toBe(1.0)
    expect(AnimationFeature.getOffset(20, 0, 10)).toBe(2.0)
  })
  it('getClampedOffset', () => {
    expect(AnimationFeature.getClampedOffset(-10, 0, 10)).toBe(0.0)
    expect(AnimationFeature.getClampedOffset(0, 0, 10)).toBe(0.0)
    expect(AnimationFeature.getClampedOffset(10, 0, 10)).toBe(1.0)
    expect(AnimationFeature.getClampedOffset(20, 0, 10)).toBe(1.0)
  })
})
