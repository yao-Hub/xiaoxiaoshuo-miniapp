export interface TtsAudioSegment {
  url: string
  byteStart: number
  byteEnd: number
  startMs: number
  durationMs: number
}

export interface TtsTimelineEntry {
  startMs: number
  endMs: number
  startOffset: number
  endOffset: number
  text: string
}

export interface TtsChapterAudio {
  chapterTitle: string
  startOffset: number
  endOffset: number
  hasMore: boolean
  segments: TtsAudioSegment[]
  timeline: TtsTimelineEntry[]
}
