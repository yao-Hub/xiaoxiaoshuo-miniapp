import { computed, ref } from 'vue'
import { createRequestCancellation, resolveApiUrl, type RequestCancellation } from '@/services/http'
import { getChapterTts } from '@/services/tts'
import type { TtsChapterStreamTiming } from '@/types/tts'

export interface AudiobookStartOptions {
  chapterUrl: string
  catalogUrl: string
  bookTitle: string
  title: string
  coverUrl: string
  paragraphIndex: number
  offsetInParagraph: number
}

export interface AudiobookPlayerPosition {
  left: number
  bottom: number
}

type AudioContext = ReturnType<typeof uni.createInnerAudioContext>

function normalizeAudioTime(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0
}

function createAudiobookState() {
  const visible = ref(false)
  const playing = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const currentTime = ref(0)
  const duration = ref(0)
  const chapterTitle = ref('')
  const bookTitle = ref('')
  const chapterUrl = ref('')
  const catalogUrl = ref('')
  const coverUrl = ref('')
  const chapterStartOffset = ref(0)
  const totalCharacters = ref(0)
  const timeline = ref<TtsChapterStreamTiming[]>([])
  const playerPosition = ref<AudiobookPlayerPosition>()

  let audio: AudioContext | undefined
  let requestController: RequestCancellation | undefined
  let requestId = 0
  let lastStartOptions: AudiobookStartOptions | undefined

  const activeTiming = computed(() => {
    const playbackMs = currentTime.value * 1000
    if (!timeline.value.length) {
      return undefined
    }
    if (playbackMs < timeline.value[0].startMs) {
      return timeline.value[0]
    }
    let low = 0
    let high = timeline.value.length - 1
    let active: TtsChapterStreamTiming | undefined
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const timing = timeline.value[middle]
      if (timing.startMs <= playbackMs) {
        active = timing
        low = middle + 1
      } else {
        high = middle - 1
      }
    }
    return active
  })
  const progress = computed(() => {
    if (!totalCharacters.value) {
      return 0
    }
    const active = activeTiming.value
    if (!active) {
      return Math.min(100, Math.round((chapterStartOffset.value / totalCharacters.value) * 100))
    }
    const sentenceRatio =
      active.endMs > active.startMs
        ? Math.min(
            1,
            Math.max(
              0,
              (currentTime.value * 1000 - active.startMs) / (active.endMs - active.startMs)
            )
          )
        : 0
    const characterOffset =
      active.startOffset + (active.endOffset - active.startOffset) * sentenceRatio
    return Math.min(100, Math.max(0, Math.round((characterOffset / totalCharacters.value) * 100)))
  })

  function getAudio() {
    if (audio) {
      return audio
    }
    audio = uni.createInnerAudioContext()
    audio.obeyMuteSwitch = false
    audio.onPlay(() => {
      playing.value = true
      loading.value = false
    })
    audio.onPause(() => {
      playing.value = false
    })
    audio.onStop(() => {
      playing.value = false
    })
    audio.onCanplay(() => {
      loading.value = false
      const audioDuration = normalizeAudioTime(audio?.duration)
      if (audioDuration > 0) {
        duration.value = audioDuration
      }
    })
    audio.onTimeUpdate(() => {
      currentTime.value = normalizeAudioTime(audio?.currentTime)
      const audioDuration = normalizeAudioTime(audio?.duration)
      if (audioDuration > 0) {
        duration.value = audioDuration
      }
    })
    audio.onEnded(() => {
      currentTime.value = duration.value
      playing.value = false
      loading.value = false
    })
    audio.onError(() => {
      errorMessage.value = '音频播放失败，请稍后重试。'
      playing.value = false
      loading.value = false
    })
    return audio
  }

  async function start(options: AudiobookStartOptions) {
    if (!options.chapterUrl) {
      return
    }
    clearPlaybackResources()
    const currentRequestId = ++requestId
    const controller = createRequestCancellation()
    requestController = controller
    lastStartOptions = options
    visible.value = true
    loading.value = true
    errorMessage.value = ''
    chapterTitle.value = options.title
    bookTitle.value = options.bookTitle
    chapterUrl.value = options.chapterUrl
    catalogUrl.value = options.catalogUrl
    coverUrl.value = options.coverUrl

    try {
      const result = await getChapterTts(
        options.chapterUrl,
        options.paragraphIndex,
        options.offsetInParagraph,
        controller
      )
      if (currentRequestId !== requestId) {
        return
      }
      chapterTitle.value = result.chapterTitle
      bookTitle.value = options.bookTitle
      chapterUrl.value = options.chapterUrl
      catalogUrl.value = options.catalogUrl
      chapterStartOffset.value = result.startOffset
      totalCharacters.value = result.totalCharacters
      timeline.value = [...(result.timeline || [])].sort(
        (left, right) => left.startMs - right.startMs
      )
      duration.value = result.durationMs / 1000
      currentTime.value = 0

      const context = getAudio()
      context.stop()
      context.src = resolveApiUrl(result.url)
      context.play()
    } catch (error) {
      if (currentRequestId !== requestId) {
        return
      }
      errorMessage.value = error instanceof Error ? error.message : '听书加载失败，请稍后重试。'
      loading.value = false
      playing.value = false
    } finally {
      if (requestController === controller) {
        requestController = undefined
      }
    }
  }

  function togglePlay() {
    if (loading.value || !visible.value) {
      return
    }
    if (errorMessage.value && lastStartOptions) {
      void start(lastStartOptions)
      return
    }
    const context = getAudio()
    if (playing.value) {
      context.pause()
    } else {
      if (duration.value > 0 && currentTime.value >= duration.value - 0.2) {
        context.seek(0)
        currentTime.value = 0
      }
      context.play()
    }
  }

  function clearPlaybackResources() {
    requestId += 1
    requestController?.abort()
    requestController = undefined
    audio?.stop()
    audio?.destroy()
    audio = undefined
    playing.value = false
    loading.value = false
    currentTime.value = 0
    duration.value = 0
    timeline.value = []
  }

  function close() {
    clearPlaybackResources()
    visible.value = false
    errorMessage.value = ''
    chapterTitle.value = ''
    bookTitle.value = ''
    chapterUrl.value = ''
    catalogUrl.value = ''
    coverUrl.value = ''
    chapterStartOffset.value = 0
    totalCharacters.value = 0
    lastStartOptions = undefined
  }

  function setPlayerPosition(position: AudiobookPlayerPosition) {
    playerPosition.value = position
  }

  function setCoverUrl(url: string) {
    coverUrl.value = url
  }

  return {
    visible,
    playing,
    loading,
    errorMessage,
    currentTime,
    duration,
    progress,
    activeTiming,
    chapterTitle,
    bookTitle,
    chapterUrl,
    catalogUrl,
    coverUrl,
    playerPosition,
    start,
    togglePlay,
    close,
    setPlayerPosition,
    setCoverUrl
  }
}

let audiobookState: ReturnType<typeof createAudiobookState> | undefined

export function useAudiobook() {
  audiobookState ||= createAudiobookState()
  return audiobookState
}
