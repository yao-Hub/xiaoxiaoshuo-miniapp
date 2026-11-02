import { computed, ref, shallowRef } from 'vue'
import type { TtsChapterAudio, TtsTimelineEntry } from '@/types/tts'
import { useAudiobookAnalytics } from '@/composables/useAudiobookAnalytics'
import { createRequestCancellation, resolveApiUrl, type RequestCancellation } from '@/services/http'
import { getChapterTts } from '@/services/tts'

export interface AudiobookStartOptions {
  chapterUrl: string
  catalogUrl: string
  bookTitle: string
  title: string
  coverUrl: string
  absoluteStartOffset: number
}

export interface AudiobookPlayerPosition {
  left: number
  bottom: number
}

type AudioContext = ReturnType<typeof uni.createInnerAudioContext>

const SEGMENT_CHARACTERS = 800

function createAudiobookState() {
  const visible = ref(false)
  const playing = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const currentTimeMs = ref(0)
  const chapterTitle = ref('')
  const bookTitle = ref('')
  const chapterUrl = ref('')
  const catalogUrl = ref('')
  const coverUrl = ref('')
  const playerPosition = ref<AudiobookPlayerPosition>()
  const analytics = useAudiobookAnalytics()
  const timeline = shallowRef<TtsTimelineEntry[]>([])

  let currentPlan: TtsChapterAudio | undefined
  let lastStartOptions: AudiobookStartOptions | undefined
  let requestController: RequestCancellation | undefined
  let queueController: RequestCancellation | undefined
  let requestId = 0
  let queueGeneration = 0
  let activeAudioIndex = 0
  let activeAudioContext: AudioContext | undefined
  let advancingPlan = false
  let nextPlanPromise: Promise<TtsChapterAudio | undefined> | undefined
  const prefetchedAudioFiles = new Map<string, string>()
  const audioDownloadTasks = new Map<string, Promise<string | undefined>>()

  const activeTimeline = computed(() => {
    const entries = timeline.value
    if (!entries.length) {
      return undefined
    }
    let low = 0
    let high = entries.length - 1
    let active: TtsTimelineEntry | undefined
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      if (entries[middle].startMs <= currentTimeMs.value) {
        active = entries[middle]
        low = middle + 1
      } else {
        high = middle - 1
      }
    }
    return active && currentTimeMs.value < active.endMs ? active : undefined
  })

  function audioKey(plan: TtsChapterAudio, segmentIndex: number) {
    return `${plan.startOffset}:${segmentIndex}`
  }

  function removePrefetchedAudioFiles() {
    const fileSystem = uni.getFileSystemManager()
    prefetchedAudioFiles.forEach((filePath) => {
      fileSystem.unlink({ filePath, fail() {} })
    })
    prefetchedAudioFiles.clear()
    audioDownloadTasks.clear()
  }

  function destroyAudioContexts() {
    const context = activeAudioContext
    activeAudioContext = undefined
    context?.destroy()
  }

  function abortQueuedWork() {
    queueGeneration += 1
    queueController?.abort()
    queueController = undefined
    nextPlanPromise = undefined
  }

  function resetPlaybackState() {
    requestId += 1
    analytics.finishPlayback('reset', {
      bookTitle: bookTitle.value,
      chapterUrl: chapterUrl.value
    })
    abortQueuedWork()
    requestController?.abort()
    requestController = undefined
    destroyAudioContexts()
    removePrefetchedAudioFiles()
    currentPlan = undefined
    timeline.value = []
    currentTimeMs.value = 0
    playing.value = false
    loading.value = false
    errorMessage.value = ''
  }

  async function fetchPlan(options: AudiobookStartOptions) {
    const result = await getChapterTts(
      options.chapterUrl,
      options.absoluteStartOffset,
      options.bookTitle,
      SEGMENT_CHARACTERS,
      requestController
    )
    if (!result.segments.length) {
      throw new Error('听书音频分段缺失，请重新加载。')
    }
    return result
  }

  function prefetchAudioSegment(plan: TtsChapterAudio, segmentIndex: number, generation: number) {
    const segment = plan.segments[segmentIndex]
    if (!segment) {
      return Promise.resolve<string | undefined>(undefined)
    }
    const key = audioKey(plan, segmentIndex)
    const cached = prefetchedAudioFiles.get(key)
    if (cached) {
      return Promise.resolve(cached)
    }
    const existing = audioDownloadTasks.get(key)
    if (existing) {
      return existing
    }
    const task = new Promise<string | undefined>((resolve) => {
      uni.downloadFile({
        url: resolveApiUrl(segment.url),
        success(response) {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            resolve(undefined)
            return
          }
          if (generation !== queueGeneration) {
            uni.getFileSystemManager().unlink({
              filePath: response.tempFilePath,
              fail() {}
            })
            resolve(undefined)
            return
          }
          prefetchedAudioFiles.set(key, response.tempFilePath)
          resolve(response.tempFilePath)
        },
        fail() {
          resolve(undefined)
        }
      })
    })
    audioDownloadTasks.set(key, task)
    void task.finally(() => {
      audioDownloadTasks.delete(key)
    })
    return task
  }

  function ensureNextPlan() {
    if (!currentPlan?.hasMore || !lastStartOptions) {
      return Promise.resolve<TtsChapterAudio | undefined>(undefined)
    }
    if (nextPlanPromise) {
      return nextPlanPromise
    }
    const generation = queueGeneration
    const controller = createRequestCancellation()
    queueController = controller
    nextPlanPromise = getChapterTts(
      lastStartOptions.chapterUrl,
      currentPlan.endOffset,
      lastStartOptions.bookTitle,
      SEGMENT_CHARACTERS,
      controller
    )
      .then((result) => {
        if (generation !== queueGeneration || !result.segments.length) {
          return undefined
        }
        return result
      })
      .catch(() => undefined)
      .finally(() => {
        if (queueController === controller) {
          queueController = undefined
        }
      })
    return nextPlanPromise
  }

  function createAudioContext(plan: TtsChapterAudio, segmentIndex: number, offsetMs = 0) {
    const segment = plan.segments[segmentIndex]
    const context = uni.createInnerAudioContext()
    context.obeyMuteSwitch = false
    context.src =
      prefetchedAudioFiles.get(audioKey(plan, segmentIndex)) || resolveApiUrl(segment.url)
    context.startTime = Math.max(0, Math.min(segment.durationMs, offsetMs) / 1000)

    context.onPlay(() => {
      if (activeAudioContext !== context) {
        return
      }
      playing.value = true
      loading.value = false
      analytics.startPlayback()
    })
    context.onPause(() => {
      if (activeAudioContext !== context) {
        return
      }
      playing.value = false
      analytics.finishPlayback('pause', {
        bookTitle: bookTitle.value,
        chapterUrl: chapterUrl.value
      })
    })
    context.onStop(() => {
      if (activeAudioContext !== context) {
        return
      }
      playing.value = false
      analytics.finishPlayback('stop', {
        bookTitle: bookTitle.value,
        chapterUrl: chapterUrl.value
      })
    })
    context.onCanplay(() => {
      if (activeAudioContext === context) {
        loading.value = false
      }
    })
    context.onTimeUpdate(() => {
      if (activeAudioContext !== context) {
        return
      }
      currentTimeMs.value = segment.startMs + Math.max(0, Number(context.currentTime) || 0) * 1000
    })
    context.onEnded(() => {
      if (activeAudioContext !== context || activeAudioIndex !== segmentIndex) {
        return
      }
      currentTimeMs.value = segment.startMs + segment.durationMs
      void advanceAudioPlayback()
    })
    context.onError(() => {
      if (activeAudioContext !== context) {
        return
      }
      errorMessage.value = '音频播放失败，请稍后重试。'
      playing.value = false
      loading.value = false
      analytics.finishPlayback('error', {
        bookTitle: bookTitle.value,
        chapterUrl: chapterUrl.value
      })
    })
    return context
  }

  async function prefetchNextAudio(plan: TtsChapterAudio, index: number, generation: number) {
    if (plan.segments[index + 1]) {
      await prefetchAudioSegment(plan, index + 1, generation)
      return
    }
    if (!plan.hasMore) {
      return
    }
    const nextPlan = await ensureNextPlan()
    if (generation === queueGeneration && nextPlan) {
      await prefetchAudioSegment(nextPlan, 0, generation)
    }
  }

  async function playAudio(plan: TtsChapterAudio, index: number, offsetMs = 0) {
    const segment = plan.segments[index]
    if (!segment) {
      return false
    }
    const generation = queueGeneration
    destroyAudioContexts()
    activeAudioIndex = index
    currentTimeMs.value = segment.startMs + Math.max(0, Math.min(segment.durationMs, offsetMs))
    loading.value = true
    await prefetchAudioSegment(plan, index, generation)
    if (currentPlan !== plan || generation !== queueGeneration) {
      return false
    }
    const context = createAudioContext(plan, index, offsetMs)
    activeAudioContext = context
    context.play()
    void prefetchNextAudio(plan, index, generation)
    return true
  }

  async function applyPlan(plan: TtsChapterAudio, options: AudiobookStartOptions) {
    destroyAudioContexts()
    currentPlan = plan
    lastStartOptions = options
    timeline.value = plan.timeline
    void ensureNextPlan()
    await playAudio(plan, 0)
  }

  async function advanceAudioPlayback() {
    if (currentPlan?.segments[activeAudioIndex + 1]) {
      await playAudio(currentPlan, activeAudioIndex + 1)
      return
    }
    await advanceTextPlayback()
  }

  async function seekToCharacterOffset(characterOffset: number) {
    const plan = currentPlan
    if (!plan) {
      return false
    }
    const timelineEntry = plan.timeline.find(
      (entry) => characterOffset >= entry.startOffset && characterOffset < entry.endOffset
    )
    if (!timelineEntry) {
      return false
    }
    const segmentIndex = plan.segments.findIndex(
      (segment) =>
        timelineEntry.startMs >= segment.startMs &&
        timelineEntry.startMs < segment.startMs + segment.durationMs
    )
    if (segmentIndex < 0) {
      return false
    }
    const generation = queueGeneration
    const audioPath = await prefetchAudioSegment(plan, segmentIndex, generation)
    if (!audioPath || currentPlan !== plan || generation !== queueGeneration) {
      return false
    }
    const segment = plan.segments[segmentIndex]
    return playAudio(plan, segmentIndex, timelineEntry.startMs - segment.startMs)
  }

  async function advanceTextPlayback() {
    if (!currentPlan || advancingPlan) {
      return
    }
    if (!currentPlan.hasMore) {
      playing.value = false
      loading.value = false
      analytics.finishPlayback('ended', {
        bookTitle: bookTitle.value,
        chapterUrl: chapterUrl.value
      })
      return
    }
    advancingPlan = true
    loading.value = true
    analytics.finishPlayback('segment', {
      bookTitle: bookTitle.value,
      chapterUrl: chapterUrl.value
    })
    try {
      const nextPlan = await ensureNextPlan()
      nextPlanPromise = undefined
      if (!nextPlan || !lastStartOptions) {
        errorMessage.value = '下一段听书内容加载失败，请重试。'
        playing.value = false
        loading.value = false
        return
      }
      await applyPlan(nextPlan, {
        ...lastStartOptions,
        absoluteStartOffset: nextPlan.startOffset
      })
    } finally {
      advancingPlan = false
    }
  }

  async function start(options: AudiobookStartOptions) {
    resetPlaybackState()
    const currentRequestId = ++requestId
    lastStartOptions = options
    visible.value = true
    loading.value = true
    errorMessage.value = ''
    chapterTitle.value = options.title
    bookTitle.value = options.bookTitle
    chapterUrl.value = options.chapterUrl
    catalogUrl.value = options.catalogUrl
    coverUrl.value = options.coverUrl
    const controller = createRequestCancellation()
    requestController = controller

    try {
      const result = await fetchPlan(options)
      if (currentRequestId !== requestId) {
        return
      }
      chapterTitle.value = result.chapterTitle
      queueGeneration += 1
      await applyPlan(result, options)
      analytics.trackStart(options, result)
    } catch (error) {
      if (currentRequestId !== requestId) {
        return
      }
      errorMessage.value = error instanceof Error ? error.message : '听书加载失败，请稍后重试。'
      loading.value = false
      playing.value = false
      uni.showToast({
        title: errorMessage.value,
        icon: 'none',
        duration: 2800
      })
      analytics.trackError(options, errorMessage.value)
    } finally {
      if (requestController === controller) {
        requestController = undefined
      }
    }
  }

  function togglePlay() {
    if (!visible.value || loading.value) {
      return
    }
    if (errorMessage.value && lastStartOptions) {
      void start(lastStartOptions)
      return
    }
    if (!activeAudioContext) {
      return
    }
    if (playing.value) {
      activeAudioContext.pause()
    } else {
      activeAudioContext.play()
    }
  }

  function close() {
    resetPlaybackState()
    visible.value = false
    chapterTitle.value = ''
    bookTitle.value = ''
    chapterUrl.value = ''
    catalogUrl.value = ''
    coverUrl.value = ''
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
    currentTimeMs,
    activeTimeline,
    chapterTitle,
    bookTitle,
    chapterUrl,
    catalogUrl,
    coverUrl,
    playerPosition,
    start,
    seekToCharacterOffset,
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
