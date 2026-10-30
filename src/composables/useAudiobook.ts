import { ref } from 'vue'
import type { TtsChapterAudio } from '@/types/tts'
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
const AUDIO_PREFETCH_CONCURRENCY = 6

function createAudiobookState() {
  const visible = ref(false)
  const playing = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const chapterTitle = ref('')
  const bookTitle = ref('')
  const chapterUrl = ref('')
  const catalogUrl = ref('')
  const coverUrl = ref('')
  const playerPosition = ref<AudiobookPlayerPosition>()
  const analytics = useAudiobookAnalytics()

  let currentPlan: TtsChapterAudio | undefined
  let lastStartOptions: AudiobookStartOptions | undefined
  let requestController: RequestCancellation | undefined
  let queueController: RequestCancellation | undefined
  let requestId = 0
  let queueGeneration = 0
  let activeAudioIndex = 0
  let activeAudioContext: AudioContext | undefined
  let queueHasMore = false
  let nextQueueOffset = 0
  let advancingPlan = false
  const planQueue: TtsChapterAudio[] = []
  const planWaiters: Array<(plan: TtsChapterAudio | undefined) => void> = []
  const prefetchedAudioFiles = new Map<string, string>()
  const audioDownloadTasks = new Map<string, Promise<string | undefined>>()
  const planAudioReady = new Map<number, Promise<void>>()
  const audioDownloadQueue: Array<{
    key: string
    url: string
    generation: number
    settled: () => void
  }> = []
  let activeAudioDownloads = 0

  function audioKey(plan: TtsChapterAudio, segmentIndex: number) {
    return `${plan.startOffset}:${segmentIndex}`
  }

  function notifyPlanWaiters(plan: TtsChapterAudio | undefined) {
    const waiters = planWaiters.splice(0)
    waiters.forEach((resolve) => resolve(plan))
  }

  function enqueuePlan(plan: TtsChapterAudio) {
    const waiter = planWaiters.shift()
    if (waiter) {
      waiter(plan)
    } else {
      planQueue.push(plan)
    }
  }

  function removePrefetchedAudioFiles() {
    const fileSystem = uni.getFileSystemManager()
    prefetchedAudioFiles.forEach((filePath) => {
      fileSystem.unlink({ filePath, fail() {} })
    })
    prefetchedAudioFiles.clear()
    audioDownloadTasks.clear()
    planAudioReady.clear()
    const queuedDownloads = audioDownloadQueue.splice(0)
    queuedDownloads.forEach((item) => item.settled())
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
    planQueue.length = 0
    queueHasMore = false
    notifyPlanWaiters(undefined)
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

  function prefetchPlanAudio(plan: TtsChapterAudio, generation: number) {
    let remaining = plan.segments.length
    const ready = new Promise<void>((resolve) => {
      if (!remaining) {
        resolve()
        return
      }
      const settle = () => {
        remaining -= 1
        if (!remaining) {
          resolve()
        }
      }
      plan.segments.forEach((segment, segmentIndex) => {
        audioDownloadQueue.push({
          key: audioKey(plan, segmentIndex),
          url: resolveApiUrl(segment.url),
          generation,
          settled: settle
        })
      })
    })
    planAudioReady.set(plan.startOffset, ready)
    scheduleAudioDownloads()
    return ready
  }

  function scheduleAudioDownloads() {
    while (activeAudioDownloads < AUDIO_PREFETCH_CONCURRENCY && audioDownloadQueue.length) {
      const item = audioDownloadQueue.shift()!
      if (item.generation !== queueGeneration) {
        item.settled()
        continue
      }
      if (prefetchedAudioFiles.has(item.key)) {
        item.settled()
        continue
      }
      activeAudioDownloads += 1
      const task = new Promise<string | undefined>((resolve) => {
        uni.downloadFile({
          url: item.url,
          success(response) {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              if (item.generation !== queueGeneration) {
                uni.getFileSystemManager().unlink({
                  filePath: response.tempFilePath,
                  fail() {}
                })
                resolve(undefined)
                return
              }
              prefetchedAudioFiles.set(item.key, response.tempFilePath)
              resolve(response.tempFilePath)
            } else {
              resolve(undefined)
            }
          },
          fail() {
            resolve(undefined)
          }
        })
      })
      audioDownloadTasks.set(item.key, task)
      void task.finally(() => {
        activeAudioDownloads -= 1
        audioDownloadTasks.delete(item.key)
        item.settled()
        scheduleAudioDownloads()
      })
    }
  }

  async function fillPlanQueue(
    generation: number,
    startOffset: number,
    options: AudiobookStartOptions
  ) {
    let offset = startOffset
    let hasMore = true
    while (hasMore && generation === queueGeneration) {
      const controller = createRequestCancellation()
      queueController = controller
      try {
        const result = await getChapterTts(
          options.chapterUrl,
          offset,
          options.bookTitle,
          SEGMENT_CHARACTERS,
          controller
        )
        if (generation !== queueGeneration) {
          return
        }
        if (!result.segments.length) {
          throw new Error('听书音频分段缺失，请重新加载。')
        }
        prefetchPlanAudio(result, generation)
        enqueuePlan(result)
        offset = result.endOffset
        hasMore = result.hasMore
      } catch {
        if (generation === queueGeneration) {
          queueHasMore = false
          notifyPlanWaiters(undefined)
        }
        return
      } finally {
        if (queueController === controller) {
          queueController = undefined
        }
      }
    }
    if (generation === queueGeneration) {
      queueHasMore = false
      notifyPlanWaiters(undefined)
    }
  }

  function createAudioContext(plan: TtsChapterAudio, segmentIndex: number) {
    const segment = plan.segments[segmentIndex]
    const context = uni.createInnerAudioContext()
    context.obeyMuteSwitch = false
    context.src =
      prefetchedAudioFiles.get(audioKey(plan, segmentIndex)) || resolveApiUrl(segment.url)

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
    context.onEnded(() => {
      if (activeAudioContext !== context || activeAudioIndex !== segmentIndex) {
        return
      }
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

  function playAudio(plan: TtsChapterAudio, index: number) {
    const segment = plan.segments[index]
    if (!segment) {
      return false
    }
    destroyAudioContexts()
    activeAudioIndex = index
    const context = createAudioContext(plan, index)
    activeAudioContext = context
    loading.value = true
    context.play()
    return true
  }

  function applyPlan(plan: TtsChapterAudio, options: AudiobookStartOptions) {
    destroyAudioContexts()
    currentPlan = plan
    lastStartOptions = options
    playAudio(plan, 0)
  }

  async function advanceAudioPlayback() {
    if (currentPlan?.segments[activeAudioIndex + 1]) {
      playAudio(currentPlan, activeAudioIndex + 1)
      return
    }
    await advanceTextPlayback()
  }

  async function takeNextPlan() {
    const queued = planQueue.shift()
    if (queued) {
      return queued
    }
    if (!queueHasMore) {
      return undefined
    }
    return new Promise<TtsChapterAudio | undefined>((resolve) => {
      planWaiters.push(resolve)
    })
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
      const nextPlan = await takeNextPlan()
      if (!nextPlan || !lastStartOptions) {
        errorMessage.value = '下一段听书内容加载失败，请重试。'
        playing.value = false
        loading.value = false
        return
      }
      await (planAudioReady.get(nextPlan.startOffset) || Promise.resolve())
      applyPlan(nextPlan, {
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
      const generation = ++queueGeneration
      queueHasMore = result.hasMore
      nextQueueOffset = result.endOffset
      prefetchPlanAudio(result, generation)
      if (queueHasMore) {
        void fillPlanQueue(generation, nextQueueOffset, options)
      }
      await (planAudioReady.get(result.startOffset) || Promise.resolve())
      applyPlan(result, options)
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
