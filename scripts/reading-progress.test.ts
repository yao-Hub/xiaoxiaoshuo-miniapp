import { describe, expect, it } from 'vitest'
import { calculateBookChapterProgress, clampReadingPosition } from '../src/utils/reading-progress'

describe('reading progress utilities', () => {
  it('clamps invalid scroll values', () => {
    expect(clampReadingPosition(-20, 100)).toBe(0)
    expect(clampReadingPosition(120, 100)).toBe(100)
    expect(clampReadingPosition(Number.NaN, 100)).toBe(0)
  })

  it('maps the current chapter to whole-book progress', () => {
    expect(calculateBookChapterProgress(0, 100)).toBe(0)
    expect(calculateBookChapterProgress(49, 100)).toBe(49)
    expect(calculateBookChapterProgress(99, 100)).toBe(100)
    expect(calculateBookChapterProgress(0, 1)).toBe(100)
  })
})
