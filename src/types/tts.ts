export interface TtsSentenceTiming {
  index: number
  text: string
  startMs: number
  endMs: number
}

export interface TtsChapterStreamTiming extends TtsSentenceTiming {
  startOffset: number
  endOffset: number
}

export interface TtsChapterAudio {
  audioId: string
  url: string
  chapterTitle: string
  totalCharacters: number
  startOffset: number
  durationMs: number
  timeline: TtsChapterStreamTiming[]
}
