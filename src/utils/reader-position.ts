import type { ReaderPageData } from '@/types/reader'
import { resolveReaderParagraphOffset } from './pagination'

export interface ReaderPosition {
  pageIndex: number
  paragraphIndex: number
  startOffset: number
}

export function findReaderPositionForOffset(
  pages: ReaderPageData[],
  paragraphs: string[],
  absoluteOffset: number
): ReaderPosition | undefined {
  const location = resolveReaderParagraphOffset(paragraphs, Math.max(0, absoluteOffset))
  if (!location) {
    return undefined
  }

  let fallback: ReaderPosition | undefined
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const line of pages[pageIndex].lines) {
      if (line.paragraphIndex !== location.paragraphIndex) {
        continue
      }
      const position = {
        pageIndex,
        paragraphIndex: location.paragraphIndex,
        startOffset: location.startOffset
      }
      fallback = position
      if (
        location.startOffset >= line.lineStartOffset &&
        location.startOffset < line.lineEndOffset
      ) {
        return position
      }
    }
  }
  return fallback
}
