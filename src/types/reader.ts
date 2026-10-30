import type { ChapterContent } from '@/types/novel'

export type ReaderPageMode = 'vertical' | 'horizontal' | 'scroll'

export interface ReaderSettings {
  fontSize: number
  brightness: number
  pageMode: ReaderPageMode
}

export interface ReaderPageModeOption {
  value: ReaderPageMode
  label: string
}

export interface ReaderPageLine {
  text: string
  paragraphEnd: boolean
  paragraphIndex: number
  lineStartOffset: number
  lineEndOffset: number
}

export interface ReaderPageData {
  lines: ReaderPageLine[]
  showHeading: boolean
}

export interface ReaderChapterBlock {
  chapter: ChapterContent
  pages: ReaderPageData[]
  key: string
}

export interface ReaderHighlightRange {
  paragraphIndex: number
  startOffset: number
  endOffset: number
}
