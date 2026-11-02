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
  audioId: string
  chapterTitle: string
  startOffset: number
  endOffset: number
  hasMore: boolean
  rate: number
  voice: string
  segments: TtsAudioSegment[]
  timeline: TtsTimelineEntry[]
}

export interface TtsVoiceOption {
  id: string
  label: string
  description: string
  gender: 'female' | 'male'
  favorite: boolean
}

export interface TtsVoiceCatalog {
  defaultVoiceId: string
  voices: TtsVoiceOption[]
}
