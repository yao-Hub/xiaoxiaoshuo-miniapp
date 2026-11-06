import { describe, expect, it } from 'vitest'
import type { ChapterContent } from '../src/types/novel'
import type { ReaderChapterBlock } from '../src/types/reader'
import {
  mergeAdjacentScrollBlocks,
  resolveScrollBlockIndex
} from '../src/utils/reader-scroll'

function createBlock(key: string): ReaderChapterBlock {
  return {
    key,
    pages: [],
    chapter: {
      chapterUrl: key
    } as ChapterContent
  }
}

describe('continuous reader scroll', () => {
  it('prepends the previous chapter and appends the next chapter around the active block', () => {
    const current = createBlock('current')
    const previous = createBlock('previous')
    const next = createBlock('next')

    const result = mergeAdjacentScrollBlocks([current], current.key, previous, next)

    expect(result.blocks.map((block) => block.key)).toEqual(['previous', 'current', 'next'])
    expect(result.activeBlockIndex).toBe(1)
    expect(result.prependedBlocks).toEqual([previous])
  })

  it('keeps existing blocks when moving into a neighboring chapter', () => {
    const previous = createBlock('previous')
    const current = createBlock('current')
    const next = createBlock('next')
    const following = createBlock('following')

    const result = mergeAdjacentScrollBlocks(
      [previous, current, next],
      next.key,
      current,
      following
    )

    expect(result.blocks.map((block) => block.key)).toEqual([
      'previous',
      'current',
      'next',
      'following'
    ])
    expect(result.activeBlockIndex).toBe(2)
    expect(result.prependedBlocks).toEqual([])
  })

  it('reports a newly prepended block when entering the previous chapter', () => {
    const earlier = createBlock('earlier')
    const previous = createBlock('previous')
    const current = createBlock('current')
    const next = createBlock('next')

    const result = mergeAdjacentScrollBlocks(
      [previous, current, next],
      previous.key,
      earlier,
      current
    )

    expect(result.blocks.map((block) => block.key)).toEqual([
      'earlier',
      'previous',
      'current',
      'next'
    ])
    expect(result.activeBlockIndex).toBe(1)
    expect(result.prependedBlocks).toEqual([earlier])
  })

  it('resolves chapter boundaries using the viewport top', () => {
    const metrics = [
      { key: 'previous', top: 0, height: 100 },
      { key: 'current', top: 100, height: 200 },
      { key: 'next', top: 300, height: 100 }
    ]

    expect(resolveScrollBlockIndex(metrics, 99)).toBe(0)
    expect(resolveScrollBlockIndex(metrics, 100)).toBe(1)
    expect(resolveScrollBlockIndex(metrics, 299)).toBe(1)
    expect(resolveScrollBlockIndex(metrics, 300)).toBe(2)
  })
})
