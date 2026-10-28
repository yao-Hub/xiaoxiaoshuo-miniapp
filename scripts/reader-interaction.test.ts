import { describe, expect, it } from 'vitest'
import { resolveReaderTapZone } from '../src/utils/reader-interaction'

describe('reader tap zones', () => {
  it('turns to the previous page from the upper reading area', () => {
    expect(resolveReaderTapZone(120, 800)).toBe('previous')
  })

  it('toggles the toolbar from the middle reading area', () => {
    expect(resolveReaderTapZone(400, 800)).toBe('toolbar')
  })

  it('turns to the next page from the lower reading area', () => {
    expect(resolveReaderTapZone(680, 800)).toBe('next')
  })

  it('falls back to the toolbar for invalid coordinates', () => {
    expect(resolveReaderTapZone(Number.NaN, 800)).toBe('toolbar')
    expect(resolveReaderTapZone(100, 0)).toBe('toolbar')
  })
})
