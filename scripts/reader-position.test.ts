import { describe, expect, it } from 'vitest'
import type { ReaderPageData } from '../src/types/reader'
import { findReaderPositionForOffset } from '../src/utils/reader-position'

const pages: ReaderPageData[] = [
  {
    showHeading: true,
    lines: [
      {
        text: '第一段开头',
        paragraphEnd: false,
        paragraphIndex: 0,
        lineStartOffset: 0,
        lineEndOffset: 5
      },
      {
        text: '第一段结尾',
        paragraphEnd: true,
        paragraphIndex: 0,
        lineStartOffset: 5,
        lineEndOffset: 10
      }
    ]
  },
  {
    showHeading: false,
    lines: [
      {
        text: '第二段',
        paragraphEnd: true,
        paragraphIndex: 1,
        lineStartOffset: 0,
        lineEndOffset: 3
      }
    ]
  }
]

describe('reader position resolution', () => {
  it('finds the page for an offset inside the first paragraph', () => {
    expect(findReaderPositionForOffset(pages, ['第一段开头结尾', '第二段'], 1)).toEqual({
      pageIndex: 0,
      paragraphIndex: 0,
      startOffset: 1
    })
    expect(findReaderPositionForOffset(pages, ['第一段开头结尾', '第二段'], 7)).toEqual({
      pageIndex: 0,
      paragraphIndex: 0,
      startOffset: 7
    })
  })

  it('maps the next paragraph to its own page', () => {
    expect(findReaderPositionForOffset(pages, ['第一段开头结尾', '第二段'], 9)).toEqual({
      pageIndex: 1,
      paragraphIndex: 1,
      startOffset: 0
    })
  })

  it('uses the last line when the offset reaches a paragraph boundary', () => {
    expect(findReaderPositionForOffset(pages, ['第一段开头结尾', '第二段'], 7)).toEqual({
      pageIndex: 0,
      paragraphIndex: 0,
      startOffset: 7
    })
  })
})
