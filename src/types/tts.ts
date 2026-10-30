export interface TtsAudioSegment {
  url: string
  byteStart: number
  byteEnd: number
}

export interface TtsChapterAudio {
  chapterTitle: string
  startOffset: number
  endOffset: number
  hasMore: boolean
  segments: TtsAudioSegment[]
}
