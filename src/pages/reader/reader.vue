<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { onHide, onLoad, onUnload } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import ReaderBottomBar from '@/components/reader/ReaderBottomBar.vue'
import ReaderCatalogSheet from '@/components/reader/ReaderCatalogSheet.vue'
import ReaderChapterContent from '@/components/reader/ReaderChapterContent.vue'
import ReaderImmersiveListenBar from '@/components/reader/ReaderImmersiveListenBar.vue'
import ReaderListenButton from '@/components/reader/ReaderListenButton.vue'
import ReaderSettingsSheet from '@/components/reader/ReaderSettingsSheet.vue'
import ReaderTopBar from '@/components/reader/ReaderTopBar.vue'
import { useAudiobook } from '@/composables/useAudiobook'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { usePageShare } from '@/composables/usePageShare'
import { useReaderCatalog } from '@/composables/useReaderCatalog'
import { useReaderEngine } from '@/composables/useReaderEngine'
import { useReaderViewport } from '@/composables/useReaderViewport'
import { usePageTheme } from '@/composables/useTheme'
import {
  DEFAULT_READER_SETTINGS,
  READER_BRIGHTNESS_MIN,
  READER_FONT_SIZE_MAX,
  READER_FONT_SIZE_MIN
} from '@/constants/reader'
import { getAuthToken, getCachedUser, hasAudiobookAccess, openLoginPage } from '@/services/auth'
import { syncUserDataFromServer } from '@/services/user-data-sync'
import { trackAnalyticsEvent } from '@/services/analytics'
import type { Chapter, ChapterContent } from '@/types/novel'
import type {
  ReaderHighlightRange,
  ReaderPageLine,
  ReaderPageMode,
  ReaderSettings
} from '@/types/reader'
import {
  getReaderLineAbsoluteOffset,
  resolveReaderParagraphOffset,
  splitChapterParagraphs
} from '@/utils/pagination'
import { resolveHorizontalReaderTapZone, resolveReaderTapZone } from '@/utils/reader-interaction'
import { findReaderPositionForOffset, type ReaderPosition } from '@/utils/reader-position'
import {
  getReaderSettings,
  getReadingRecord,
  rememberReading,
  saveReaderSettings,
  updateReadingProgress
} from '@/utils/storage'

interface SwiperFinishEvent {
  detail: {
    current: number
  }
}

interface ReaderScrollEvent {
  detail: {
    scrollTop: number
  }
}

interface ReaderListeningStart {
  chapterUrl: string
  pageIndex: number
  absoluteOffset: number
}

interface PendingAudiobookStart {
  chapterUrl: string
  pageIndex: number
  scrollTop: number
}

const readerSettings = reactive<ReaderSettings>(getReaderSettings())
const audiobook = useAudiobook()
const audiobookEnabled = computed(() => hasAudiobookAccess(getCachedUser()))
const viewport = useReaderViewport()
const readerEngine = useReaderEngine({
  settings: readerSettings,
  pageContentHeight: viewport.pageContentHeight,
  pageViewportHeight: viewport.pageViewportHeight,
  textWidthPx: viewport.textWidthPx,
  getAdjacentUrls: resolveAdjacentUrls,
  onChapterCommitted: handleChapterCommitted
})
const {
  windowKey,
  chapter,
  chapterUrl,
  catalogUrl,
  requestedChapterUrl,
  readerPages,
  currentPageIndex,
  currentSwiperIndex,
  swiperPages,
  previousChapterUrl,
  nextChapterUrl,
  loading,
  errorMessage,
  interactionLocked,
  fontSizePx,
  scrollReaderTop,
  scrollRestoreTop,
  scrollBlocks,
  scrollAnchorLocked,
  loadDirectChapter,
  refreshWindow,
  commitSwiperIndex,
  moveToAdjacentChapter,
  turnPage,
  setPageIndex,
  rebuildPages,
  setScrollPosition,
  getActiveScrollTop,
  estimatePageScrollTop,
  estimateScrollTopForReaderPosition,
  getVisibleScrollLine,
  syncPageIndexFromScroll,
  getReadingProgress,
  cancelPendingLoad
} = readerEngine

const bookTitle = ref('')
const routeCoverUrl = ref('')
const fallbackCatalogUrl = ref('')
usePageAnalytics('reader', {
  sessionEventType: 'reader_session',
  getContext: () => ({
    bookTitle: bookTitle.value,
    chapterUrl: chapterUrl.value
  })
})
const effectiveCatalogUrl = computed(() => catalogUrl.value || fallbackCatalogUrl.value)
const readerCatalog = useReaderCatalog({
  catalogUrl: effectiveCatalogUrl,
  currentChapterUrl: chapterUrl,
  bookTitle,
  fallbackCoverUrl: routeCoverUrl
})
const {
  chapters: catalogChapters,
  loading: catalogLoading,
  errorMessage: catalogError,
  visible: catalogVisible,
  dragPreviewIndex,
  bookCoverUrl,
  currentChapterIndex,
  sliderValue,
  sliderMax,
  previewProgress,
  previewChapterTitle,
  sliderPlaceholder,
  ensureCatalog,
  openCatalog: showCatalog,
  closeCatalog,
  retryCatalog,
  previewChapter,
  clearChapterPreview,
  resolveChapterAt
} = readerCatalog

usePageShare(() => {
  const targetChapterUrl = chapterUrl.value || requestedChapterUrl.value
  if (!targetChapterUrl) {
    return '/pages/index/index'
  }
  return `/pages/reader/reader?chapterUrl=${encodeURIComponent(targetChapterUrl)}&catalogUrl=${encodeURIComponent(effectiveCatalogUrl.value)}&bookTitle=${encodeURIComponent(bookTitle.value)}&coverUrl=${encodeURIComponent(bookCoverUrl.value || routeCoverUrl.value)}`
})

watch(
  bookCoverUrl,
  (coverUrl) => {
    if (coverUrl && audiobook.visible.value) {
      audiobook.setCoverUrl(coverUrl)
    }
  },
  { immediate: true }
)

const { themeClass, resolvedTheme, toggleResolvedTheme } = usePageTheme()
const toolbarVisible = ref(false)
const settingsVisible = ref(false)
const catalogAutoLocate = ref(false)
const catalogAutoLocatedOnce = ref(false)
let tapStartX = 0
let tapStartY = 0
let settingsSaveTimer: ReturnType<typeof setTimeout> | undefined
let lastScrollPersistAt = 0
let lastReaderScrollAt = 0
let lastCommittedChapterUrl = ''

const fatalError = computed(() => Boolean(errorMessage.value) && !chapter.value)
const showTopBar = computed(() => toolbarVisible.value || loading.value || fatalError.value)
const showReaderControls = computed(
  () => Boolean(chapter.value) && swiperPages.value.length > 0 && !fatalError.value
)
const chapterParagraphs = computed(() =>
  chapter.value ? splitChapterParagraphs(chapter.value.content) : []
)
const chapterFullText = computed(() => chapterParagraphs.value.join('\n\n'))
const audiobookHighlight = ref<{
  chapterUrl: string
  ranges: ReaderHighlightRange[]
}>()
const audiobookHighlightRanges = computed(() =>
  audiobookHighlight.value?.chapterUrl === chapterUrl.value
    ? audiobookHighlight.value.ranges
    : undefined
)
const audiobookPlaybackPosition = ref<
  | (ReaderPosition & {
      chapterUrl: string
      absoluteOffset: number
    })
  | undefined
>()
const audiobookAutoFollowEnabled = ref(false)
const pendingAudiobookStart = ref<PendingAudiobookStart>()
let audiobookStartViewChanged = false
let syncingAudiobookPage = false
let syncingAudiobookScroll = false
let syncingAudiobookChapter = false
let audiobookScrollSyncTimer: ReturnType<typeof setTimeout> | undefined

function isTimelineTextAligned(timing: NonNullable<typeof audiobook.activeTimeline.value>) {
  const expectedText = chapterFullText.value
    .slice(timing.startOffset, timing.endOffset)
    .replace(/[\r\n\u2028\u2029]/g, '')
  return timing.text === expectedText
}

watch(
  [
    audiobook.activeTimeline,
    audiobook.chapterUrl,
    audiobook.visible,
    chapterUrl,
    chapterFullText,
    chapterParagraphs,
    readerPages
  ],
  ([timing, playbackChapterUrl, visible, displayedChapterUrl, , paragraphs, pages]) => {
    if (!visible) {
      audiobookHighlight.value = undefined
      audiobookPlaybackPosition.value = undefined
      audiobookAutoFollowEnabled.value = false
      clearPendingAudiobookStart()
      return
    }
    if (playbackChapterUrl !== displayedChapterUrl) {
      return
    }
    if (!timing) {
      audiobookHighlight.value = undefined
      return
    }
    if (!isTimelineTextAligned(timing)) {
      audiobookHighlight.value = undefined
      return
    }
    const playbackPosition = findReaderPositionForOffset(pages, paragraphs, timing.startOffset)
    if (playbackPosition) {
      const position = {
        ...playbackPosition,
        chapterUrl: displayedChapterUrl,
        absoluteOffset: timing.startOffset
      }
      audiobookPlaybackPosition.value = position
      resolvePendingAudiobookStart(position)
    }
    const ranges: ReaderHighlightRange[] = []
    let cursor = timing.startOffset
    while (cursor < timing.endOffset) {
      const location = resolveReaderParagraphOffset(chapterParagraphs.value, cursor)
      const paragraph = location ? chapterParagraphs.value[location.paragraphIndex] : undefined
      if (!location || !paragraph) {
        break
      }
      const startOffset = location.startOffset
      const available = paragraph.length - startOffset
      const paragraphStart = getReaderLineAbsoluteOffset(chapterParagraphs.value, {
        paragraphIndex: location.paragraphIndex,
        lineStartOffset: 0
      })
      const take = Math.min(available, timing.endOffset - cursor)
      if (take <= 0) {
        break
      }
      ranges.push({
        paragraphIndex: location.paragraphIndex,
        startOffset,
        endOffset: startOffset + take
      })
      cursor = paragraphStart + startOffset + take
      if (cursor < timing.endOffset) {
        cursor += 2
      }
    }
    if (ranges.length) {
      audiobookHighlight.value = {
        chapterUrl: displayedChapterUrl,
        ranges
      }
    } else {
      audiobookHighlight.value = undefined
    }
  }
)
const audiobookPlaybackPageIndex = computed(() =>
  audiobookPlaybackPosition.value?.chapterUrl === chapterUrl.value
    ? audiobookPlaybackPosition.value.pageIndex
    : undefined
)
const isAudiobookChapterDisplayed = computed(
  () =>
    audiobook.visible.value &&
    Boolean(audiobookPlaybackPosition.value) &&
    audiobookPlaybackPosition.value?.chapterUrl === chapterUrl.value
)
const isAudiobookOnCurrentPage = computed(
  () =>
    isAudiobookChapterDisplayed.value &&
    audiobookPlaybackPageIndex.value !== undefined &&
    audiobookPlaybackPageIndex.value === currentPageIndex.value
)
const showAudiobookPlaybackControls = computed(
  () =>
    audiobook.visible.value && (!audiobookPlaybackPosition.value || isAudiobookOnCurrentPage.value)
)
const showAudiobookOriginalProgress = computed(
  () =>
    audiobook.visible.value &&
    Boolean(audiobookPlaybackPosition.value) &&
    (!isAudiobookChapterDisplayed.value || !audiobookAutoFollowEnabled.value)
)
const brightnessOverlayStyle = computed(() => ({
  opacity: String((100 - readerSettings.brightness) / 100)
}))

watch(currentPageIndex, (nextPageIndex) => {
  if (syncingAudiobookPage || syncingAudiobookScroll) {
    return
  }
  const pendingStart = pendingAudiobookStart.value
  if (
    pendingStart &&
    (pendingStart.pageIndex !== nextPageIndex || pendingStart.chapterUrl !== chapterUrl.value)
  ) {
    audiobookStartViewChanged = true
  }
  const playbackPageIndex = audiobookPlaybackPageIndex.value
  if (!audiobook.visible.value || playbackPageIndex === undefined) {
    return
  }
  if (nextPageIndex === playbackPageIndex) {
    if (audiobook.playing.value) {
      audiobookAutoFollowEnabled.value = true
    }
    return
  }
  audiobookAutoFollowEnabled.value = false
})

watch(chapterUrl, (nextChapterUrl) => {
  const pendingStart = pendingAudiobookStart.value
  if (pendingStart && pendingStart.chapterUrl !== nextChapterUrl) {
    audiobookStartViewChanged = true
  }
  if (audiobook.visible.value && nextChapterUrl !== audiobook.chapterUrl.value) {
    audiobookAutoFollowEnabled.value = false
  }
})

watch(
  [audiobook.chapterUrl, audiobook.loading, audiobook.visible],
  ([playbackChapterUrl, isLoading, visible]) => {
    if (
      !visible ||
      isLoading ||
      syncingAudiobookChapter ||
      !playbackChapterUrl ||
      playbackChapterUrl === chapterUrl.value ||
      !audiobookAutoFollowEnabled.value
    ) {
      return
    }
    syncingAudiobookChapter = true
    void loadDirectChapter(playbackChapterUrl, { pageIndex: 0 })
      .then((succeeded) => {
        if (!succeeded) {
          return
        }
        clearPendingAudiobookStart()
        audiobookAutoFollowEnabled.value = true
        void ensureCatalog().then(() => refreshWindow())
      })
      .finally(() => {
        syncingAudiobookChapter = false
      })
  },
  { flush: 'post' }
)

watch(
  [
    audiobookPlaybackPageIndex,
    audiobookPlaybackPosition,
    audiobook.playing,
    audiobook.visible,
    chapterUrl,
    () => readerSettings.pageMode
  ],
  ([playbackPageIndex, playbackPosition, playing, visible, displayedChapterUrl, pageMode]) => {
    if (
      !visible ||
      !playing ||
      !playbackPosition ||
      playbackPosition.chapterUrl !== displayedChapterUrl
    ) {
      return
    }
    if (pageMode !== 'scroll' && playbackPageIndex === currentPageIndex.value) {
      audiobookAutoFollowEnabled.value = true
      return
    }
    if (!audiobookAutoFollowEnabled.value) {
      return
    }
    if (pageMode === 'scroll') {
      centerAudiobookPositionInScrollMode(playbackPosition)
      return
    }
    if (playbackPageIndex === undefined || playbackPageIndex === currentPageIndex.value) {
      return
    }
    if (playbackPageIndex < currentPageIndex.value) {
      audiobookAutoFollowEnabled.value = false
      return
    }
    syncingAudiobookPage = true
    setPageIndex(playbackPageIndex)
    void nextTick(() => {
      syncingAudiobookPage = false
    })
  },
  { flush: 'post' }
)

function clearAudiobookScrollSyncTimer() {
  if (audiobookScrollSyncTimer) {
    clearTimeout(audiobookScrollSyncTimer)
    audiobookScrollSyncTimer = undefined
  }
}

function clearPendingAudiobookStart() {
  pendingAudiobookStart.value = undefined
  audiobookStartViewChanged = false
}

function resolvePendingAudiobookStart(
  playbackPosition: ReaderPosition & {
    chapterUrl: string
    absoluteOffset: number
  }
) {
  const pendingStart = pendingAudiobookStart.value
  if (!pendingStart) {
    return
  }
  const matchesStartPage =
    readerSettings.pageMode === 'scroll' || playbackPosition.pageIndex === pendingStart.pageIndex
  const shouldFollow =
    !audiobookStartViewChanged &&
    pendingStart.chapterUrl === playbackPosition.chapterUrl &&
    matchesStartPage
  clearPendingAudiobookStart()
  audiobookAutoFollowEnabled.value = shouldFollow
  if (shouldFollow && readerSettings.pageMode === 'scroll') {
    centerAudiobookPositionInScrollMode(playbackPosition)
  }
}

function centerAudiobookPositionInScrollMode(position = audiobookPlaybackPosition.value) {
  if (
    !position ||
    position.chapterUrl !== chapterUrl.value ||
    readerSettings.pageMode !== 'scroll'
  ) {
    return
  }
  const scrollTop = estimateScrollTopForReaderPosition(
    position.paragraphIndex,
    position.startOffset
  )
  if (scrollTop === undefined) {
    return
  }
  clearAudiobookScrollSyncTimer()
  syncingAudiobookScroll = true
  setScrollPosition(scrollTop)
  audiobookScrollSyncTimer = setTimeout(() => {
    syncingAudiobookScroll = false
    audiobookScrollSyncTimer = undefined
  }, 600)
}

watch(
  () => catalogChapters.value.length,
  (chapterCount) => {
    if (chapterCount && chapter.value) {
      void refreshWindow()
    }
  }
)

onLoad(async (options) => {
  await syncUserDataFromServer()
  Object.assign(readerSettings, getReaderSettings())
  const initialChapterUrl = decodeURIComponent(String(options?.chapterUrl || ''))
  fallbackCatalogUrl.value = decodeURIComponent(String(options?.catalogUrl || ''))
  bookTitle.value = decodeURIComponent(String(options?.bookTitle || ''))
  routeCoverUrl.value = decodeURIComponent(String(options?.coverUrl || ''))

  const savedRecord = initialChapterUrl ? getReadingRecord(initialChapterUrl) : undefined
  const succeeded = await loadDirectChapter(initialChapterUrl, {
    pageIndex: savedRecord?.pageIndex || 0,
    scrollTop: savedRecord?.scrollTop || 0
  })
  if (succeeded) {
    void ensureCatalog().then(() => refreshWindow())
  }
})

onHide(() => {
  persistReadingProgress()
  persistReaderSettings()
})

onUnload(() => {
  persistReadingProgress()
  persistReaderSettings()
  cancelPendingLoad()
  clearAudiobookScrollSyncTimer()
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer)
    settingsSaveTimer = undefined
  }
})

function resolveAdjacentUrls(sourceChapter: ChapterContent) {
  const chapterIndex = catalogChapters.value.findIndex(
    (item) => item.url === sourceChapter.chapterUrl
  )
  if (catalogChapters.value.length && chapterIndex >= 0) {
    return {
      previousUrl: catalogChapters.value[chapterIndex - 1]?.url || '',
      nextUrl: catalogChapters.value[chapterIndex + 1]?.url || ''
    }
  }
  return {
    previousUrl: sourceChapter.prevUrl,
    nextUrl: sourceChapter.nextUrl
  }
}

function resolveNextPlaybackChapter(sourceChapterUrl: string) {
  const chapterIndex = catalogChapters.value.findIndex((item) => item.url === sourceChapterUrl)
  const nextFromCatalog = chapterIndex >= 0 ? catalogChapters.value[chapterIndex + 1] : undefined
  if (nextFromCatalog) {
    return {
      url: nextFromCatalog.url,
      title: nextFromCatalog.title
    }
  }
  if (sourceChapterUrl === chapterUrl.value && nextChapterUrl.value) {
    return {
      url: nextChapterUrl.value
    }
  }
  return undefined
}

function handleChapterCommitted(targetChapter: ChapterContent, pageIndex: number) {
  clearChapterPreview()
  if (lastCommittedChapterUrl !== targetChapter.chapterUrl) {
    lastCommittedChapterUrl = targetChapter.chapterUrl
    trackAnalyticsEvent('chapter_change', {
      page: 'reader',
      bookTitle: bookTitle.value,
      chapterUrl: targetChapter.chapterUrl,
      metadata: { chapterTitle: targetChapter.title }
    })
    rememberReading({
      key: targetChapter.catalogUrl || targetChapter.chapterUrl,
      bookTitle: bookTitle.value || '未命名作品',
      chapterTitle: targetChapter.title,
      chapterUrl: targetChapter.chapterUrl,
      catalogUrl: targetChapter.catalogUrl,
      coverUrl: bookCoverUrl.value || routeCoverUrl.value,
      scrollTop: readerSettings.pageMode === 'scroll' ? getActiveScrollTop() : 0,
      pageIndex,
      progress: 0,
      updatedAt: Date.now()
    })
  }
  persistReadingProgress()
}

function persistReadingProgress() {
  if (!chapter.value || !readerPages.value.length) {
    return
  }
  updateReadingProgress({
    chapterUrl: chapter.value.chapterUrl,
    coverUrl: bookCoverUrl.value || routeCoverUrl.value,
    scrollTop: readerSettings.pageMode === 'scroll' ? getActiveScrollTop() : 0,
    progress: getReadingProgress(),
    pageIndex: currentPageIndex.value,
    updatedAt: Date.now()
  })
}

function handleSwiperFinish(event: SwiperFinishEvent) {
  const nextIndex = Number(event.detail.current)
  void commitSwiperIndex(nextIndex)
}

function handleScrollModeScroll(event: ReaderScrollEvent) {
  if (readerSettings.pageMode !== 'scroll') {
    return
  }
  if (scrollAnchorLocked.value) {
    return
  }
  scrollReaderTop.value = Math.max(0, event.detail.scrollTop)
  lastReaderScrollAt = Date.now()
  syncPageIndexFromScroll()
  const pendingStart = pendingAudiobookStart.value
  if (
    pendingStart &&
    !syncingAudiobookScroll &&
    (chapterUrl.value !== pendingStart.chapterUrl ||
      Math.abs(getActiveScrollTop() - pendingStart.scrollTop) > 1)
  ) {
    audiobookStartViewChanged = true
  }
  if (!syncingAudiobookScroll) {
    audiobookAutoFollowEnabled.value = false
  }

  const now = Date.now()
  if (now - lastScrollPersistAt >= 500) {
    lastScrollPersistAt = now
    persistReadingProgress()
  }
}

function captureReaderTouch(event: TouchEvent) {
  tapStartX = event.touches[0]?.clientX || 0
  tapStartY = event.touches[0]?.clientY || 0
}

function suspendAudiobookAutoFollow() {
  if (pendingAudiobookStart.value) {
    audiobookStartViewChanged = true
  }
  audiobookAutoFollowEnabled.value = false
}

function extractTapX(event: MouseEvent | TouchEvent) {
  if ('clientX' in event && typeof event.clientX === 'number') {
    return event.clientX
  }
  if ('changedTouches' in event && event.changedTouches[0]?.clientX) {
    return event.changedTouches[0].clientX
  }
  const detail = (event as Event & { detail?: unknown }).detail
  if (
    typeof detail === 'object' &&
    detail !== null &&
    'x' in detail &&
    typeof detail.x === 'number'
  ) {
    return detail.x
  }
  return tapStartX
}

function extractTapY(event: MouseEvent | TouchEvent) {
  if ('clientY' in event && typeof event.clientY === 'number') {
    return event.clientY
  }
  if ('changedTouches' in event && event.changedTouches[0]?.clientY) {
    return event.changedTouches[0].clientY
  }
  const detail = (event as Event & { detail?: unknown }).detail
  if (
    typeof detail === 'object' &&
    detail !== null &&
    'y' in detail &&
    typeof detail.y === 'number'
  ) {
    return detail.y
  }
  return tapStartY
}

function handleReaderTap(event: MouseEvent | TouchEvent) {
  if (interactionLocked.value || loading.value) {
    return
  }
  if (toolbarVisible.value) {
    toolbarVisible.value = false
    return
  }
  if (readerSettings.pageMode === 'scroll') {
    if (Date.now() - lastReaderScrollAt < 250) {
      return
    }
    const tapX = extractTapX(event)
    const tapY = extractTapY(event)
    if (
      tapX >= viewport.windowWidth * 0.35 &&
      tapX <= viewport.windowWidth * 0.65 &&
      tapY >= viewport.viewportHeight * 0.35 &&
      tapY <= viewport.viewportHeight * 0.65
    ) {
      toolbarVisible.value = true
    }
    return
  }

  const zone =
    readerSettings.pageMode === 'horizontal'
      ? resolveHorizontalReaderTapZone(extractTapX(event), viewport.windowWidth)
      : resolveReaderTapZone(extractTapY(event), viewport.viewportHeight)
  if (zone === 'toolbar') {
    toolbarVisible.value = true
    return
  }
  void turnReaderPage(zone === 'previous' ? -1 : 1)
}

async function turnReaderPage(direction: -1 | 1) {
  const succeeded = await turnPage(direction)
  if (succeeded) {
    return
  }
  const hasAdjacentChapter =
    direction > 0 ? Boolean(nextChapterUrl.value) : Boolean(previousChapterUrl.value)
  uni.showToast({
    title: hasAdjacentChapter
      ? direction > 0
        ? '下一章暂时无法加载'
        : '上一章暂时无法加载'
      : direction > 0
        ? '已经是最后一章'
        : '已经是第一章',
    icon: 'none'
  })
}

async function selectCatalogChapter(targetChapter: Chapter) {
  closeCatalog()
  if (targetChapter.url === chapterUrl.value) {
    setPageIndex(0)
    if (readerSettings.pageMode === 'scroll') {
      setScrollPosition(0)
    }
    return
  }
  await loadSelectedChapter(targetChapter.url)
}

async function seekChapter(index: number) {
  clearChapterPreview()
  const targetChapter = resolveChapterAt(index)
  if (!targetChapter || targetChapter.url === chapterUrl.value) {
    return
  }
  await loadSelectedChapter(targetChapter.url)
}

async function loadSelectedChapter(targetUrl: string) {
  const succeeded = await loadDirectChapter(targetUrl, { pageIndex: 0 })
  if (succeeded) {
    void ensureCatalog().then(() => refreshWindow())
    return
  }
  if (chapter.value) {
    uni.showToast({ title: errorMessage.value || '章节加载失败', icon: 'none' })
    errorMessage.value = ''
  }
}

function goBack() {
  persistReadingProgress()
  if (getCurrentPages().length > 1) {
    uni.navigateBack({
      delta: 1,
      fail: goHome
    })
    return
  }
  goHome()
}

function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
    fail() {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  })
}

function getCurrentListeningStart(): ReaderListeningStart | undefined {
  if (!chapter.value) {
    return undefined
  }
  const line: ReaderPageLine | undefined =
    readerSettings.pageMode === 'scroll'
      ? getVisibleScrollLine(scrollReaderTop.value)
      : readerPages.value[currentPageIndex.value]?.lines[0]
  if (!line) {
    return undefined
  }
  return {
    chapterUrl: chapter.value.chapterUrl,
    pageIndex: currentPageIndex.value,
    absoluteOffset: getReaderLineAbsoluteOffset(chapterParagraphs.value, line)
  }
}

function startAudiobook(start = getCurrentListeningStart()) {
  if (!chapter.value || !start) {
    uni.showToast({ title: '无法定位当前页的朗读位置', icon: 'none' })
    return false
  }
  const startOptions = {
    chapterUrl: start.chapterUrl,
    catalogUrl: effectiveCatalogUrl.value,
    bookTitle: bookTitle.value,
    title: chapter.value.title,
    coverUrl: bookCoverUrl.value,
    absoluteStartOffset: start.absoluteOffset,
    resolveNextChapter: resolveNextPlaybackChapter
  }
  pendingAudiobookStart.value = {
    chapterUrl: start.chapterUrl,
    pageIndex: start.pageIndex,
    scrollTop: getActiveScrollTop()
  }
  audiobookStartViewChanged = false
  audiobookPlaybackPosition.value = undefined
  audiobookAutoFollowEnabled.value = false
  const preserveSleepTimer =
    audiobook.visible.value && audiobook.catalogUrl.value === startOptions.catalogUrl
  void audiobook.start(startOptions, preserveSleepTimer).then(() => {
    if (audiobook.errorMessage.value) {
      clearPendingAudiobookStart()
    }
  })
  return true
}

async function listenFromCurrentPage() {
  const start = getCurrentListeningStart()
  if (
    start &&
    audiobook.chapterUrl.value === start.chapterUrl &&
    (await audiobook.seekToCharacterOffset(start.absoluteOffset))
  ) {
    clearPendingAudiobookStart()
    audiobookAutoFollowEnabled.value = true
    return true
  }
  return startAudiobook(start)
}

async function locateAudiobookProgress() {
  clearPendingAudiobookStart()
  const playbackPosition = audiobookPlaybackPosition.value
  if (!playbackPosition) {
    return
  }
  if (playbackPosition.chapterUrl !== chapterUrl.value) {
    const succeeded = await loadDirectChapter(playbackPosition.chapterUrl, {
      pageIndex: 0,
      absoluteOffset: playbackPosition.absoluteOffset
    })
    if (!succeeded) {
      uni.showToast({ title: errorMessage.value || '无法定位播放位置', icon: 'none' })
      return
    }
    audiobookAutoFollowEnabled.value = true
    return
  }
  if (readerSettings.pageMode === 'scroll') {
    centerAudiobookPositionInScrollMode(playbackPosition)
  } else {
    syncingAudiobookPage = true
    setPageIndex(playbackPosition.pageIndex)
    await nextTick()
    syncingAudiobookPage = false
  }
  audiobookAutoFollowEnabled.value = true
}

function openCatalog() {
  catalogAutoLocate.value = !catalogAutoLocatedOnce.value
  catalogAutoLocatedOnce.value = true
  showCatalog()
}

function closeSettings() {
  settingsVisible.value = false
  persistReaderSettings()
}

function changeFontSize(value: number) {
  readerSettings.fontSize = Math.min(READER_FONT_SIZE_MAX, Math.max(READER_FONT_SIZE_MIN, value))
  if (chapter.value) {
    rebuildPages()
  }
  persistReaderSettings()
}

function changeBrightness(value: number) {
  readerSettings.brightness = Math.min(100, Math.max(READER_BRIGHTNESS_MIN, value))
  scheduleReaderSettingsSave()
}

function changePageMode(value: ReaderPageMode) {
  const previousMode = readerSettings.pageMode
  if (previousMode === 'scroll') {
    syncPageIndexFromScroll()
  }
  readerSettings.pageMode = value
  if (value === 'scroll') {
    setScrollPosition(estimatePageScrollTop(currentPageIndex.value))
  }
  persistReadingProgress()
  persistReaderSettings()
}

function resetReaderSettings() {
  if (readerSettings.pageMode === 'scroll') {
    syncPageIndexFromScroll()
  }
  const fontSizeChanged = readerSettings.fontSize !== DEFAULT_READER_SETTINGS.fontSize
  Object.assign(readerSettings, DEFAULT_READER_SETTINGS)
  if (chapter.value && fontSizeChanged) {
    rebuildPages()
  } else if (readerSettings.pageMode === 'scroll') {
    setScrollPosition(estimatePageScrollTop(currentPageIndex.value))
  }
  persistReaderSettings()
}

function scheduleReaderSettingsSave() {
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer)
  }
  settingsSaveTimer = setTimeout(() => {
    persistReaderSettings()
    settingsSaveTimer = undefined
  }, 250)
}

function persistReaderSettings() {
  saveReaderSettings({ ...readerSettings })
}

async function retryLoad() {
  const targetUrl = requestedChapterUrl.value || chapterUrl.value
  if (!targetUrl) {
    uni.showToast({ title: '章节地址缺失，无法重试', icon: 'none' })
    return
  }
  if (!getAuthToken()) {
    const redirectUrl = `/pages/reader/reader?chapterUrl=${encodeURIComponent(targetUrl)}&catalogUrl=${encodeURIComponent(effectiveCatalogUrl.value)}&bookTitle=${encodeURIComponent(bookTitle.value)}`
    uni.showModal({
      title: '登录状态已失效',
      content: '请重新登录后继续阅读。',
      confirmText: '去登录',
      cancelText: '取消',
      success(result) {
        if (result.confirm) {
          openLoginPage(redirectUrl)
        }
      }
    })
    return
  }

  const isCurrentChapter = targetUrl === chapterUrl.value
  uni.showLoading({ title: '正在重新加载', mask: true })
  const succeeded = await loadDirectChapter(targetUrl, {
    pageIndex: isCurrentChapter ? currentPageIndex.value : 0,
    scrollTop: isCurrentChapter ? getActiveScrollTop() : 0
  })
  uni.hideLoading()
  if (succeeded) {
    void ensureCatalog().then(() => refreshWindow())
  } else {
    uni.showToast({
      title: errorMessage.value || '加载失败，请稍后重试',
      icon: 'none'
    })
  }
}
</script>

<template>
  <view
    class="reader-page"
    :class="themeClass"
    :style="{ height: `${viewport.readerPageHeight}px` }"
  >
    <ReaderTopBar
      v-if="showTopBar"
      :book-title="bookTitle"
      :chapter-title="loading ? '正在加载' : fatalError ? '读取失败' : chapter?.title || ''"
      :top-inset="viewport.topInset.value"
      :right-inset="viewport.rightInset.value"
      @back="goBack"
    />

    <view v-if="loading" class="reader-state">
      <view class="state-mark">西</view>
      <view class="state-title">正在加载正文</view>
      <view class="state-description">正在整理章节内容，请稍候。</view>
    </view>

    <view v-else-if="fatalError" class="reader-state">
      <view class="state-title">正文加载失败</view>
      <view class="state-description">{{ errorMessage }}</view>
      <view class="state-actions">
        <button class="state-button" @tap.stop="goBack">返回</button>
        <button class="state-button primary" @tap.stop="retryLoad">重新加载</button>
      </view>
    </view>

    <view v-else-if="chapter?.contentUnavailable" class="reader-state">
      <view class="state-title">当前来源暂不可读</view>
      <view class="state-description">
        {{ chapter.contentUnavailableReason || '该章节需要会员，当前来源暂不提供正文。' }}
      </view>
      <view class="state-actions">
        <button class="state-button" @tap.stop="goBack">返回</button>
      </view>
    </view>

    <view v-else-if="chapter && !swiperPages.length" class="reader-state">
      <view class="state-title">正在准备正文</view>
      <view class="state-description">请稍候，正在生成阅读页面。</view>
    </view>

    <view
      v-else-if="chapter && readerSettings.pageMode === 'scroll'"
      class="paged-area"
      :style="{
        height: `${viewport.pageViewportHeight.value}px`,
        marginTop: `${viewport.contentTopInset.value}px`
      }"
    >
      <scroll-view
        class="scroll-reader"
        scroll-y
        :scroll-top="scrollRestoreTop"
        @tap="handleReaderTap"
        @touchstart="captureReaderTouch"
        @touchmove="suspendAudiobookAutoFollow"
        @scroll="handleScrollModeScroll"
      >
        <ReaderChapterContent
          v-for="block in scrollBlocks"
          :key="block.key"
          flow="scroll"
          :book-title="bookTitle"
          :chapter-title="block.chapterTitle"
          :lines="block.lines"
          :show-heading="block.showHeading"
          :font-size-px="fontSizePx"
          :highlight-ranges="block.key === chapterUrl ? audiobookHighlightRanges : undefined"
        />
      </scroll-view>
    </view>

    <view
      v-else-if="chapter"
      class="paged-area"
      :style="{
        height: `${viewport.pageViewportHeight.value}px`,
        marginTop: `${viewport.contentTopInset.value}px`
      }"
    >
      <swiper
        :key="windowKey"
        class="reader-swiper"
        :style="{ height: `${viewport.pageViewportHeight.value}px` }"
        :current="currentSwiperIndex"
        :vertical="readerSettings.pageMode === 'vertical'"
        :duration="interactionLocked ? 0 : 260"
        :disable-touch="interactionLocked || loading"
        @tap="handleReaderTap"
        @touchstart="captureReaderTouch"
        @touchmove="suspendAudiobookAutoFollow"
        @animationfinish="handleSwiperFinish"
      >
        <swiper-item v-for="item in swiperPages" :key="item.key">
          <ReaderChapterContent
            flow="page"
            :book-title="bookTitle"
            :chapter-title="item.chapterTitle"
            :lines="item.page.lines"
            :show-heading="item.page.showHeading"
            :font-size-px="fontSizePx"
            :highlight-ranges="audiobookHighlightRanges"
          />
        </swiper-item>
      </swiper>
    </view>

    <ReaderBottomBar
      v-if="toolbarVisible && showReaderControls"
      :slider-value="sliderValue"
      :slider-max="sliderMax"
      :slider-disabled="catalogLoading || !catalogChapters.length || currentChapterIndex < 0"
      :slider-placeholder="sliderPlaceholder"
      :previewing="dragPreviewIndex !== undefined"
      :preview-title="previewChapterTitle"
      :preview-progress="previewProgress"
      :theme="resolvedTheme"
      :previous-disabled="interactionLocked || loading || !previousChapterUrl"
      :next-disabled="interactionLocked || loading || !nextChapterUrl"
      @previous="moveToAdjacentChapter('previous', { instant: true })"
      @next="moveToAdjacentChapter('next', { enterAtStart: true, instant: true })"
      @catalog="openCatalog"
      @settings="settingsVisible = true"
      @toggle-theme="toggleResolvedTheme"
      @preview="previewChapter"
      @preview-end="clearChapterPreview"
      @seek="seekChapter"
    />

    <ReaderListenButton
      v-if="audiobookEnabled && toolbarVisible && showReaderControls && !audiobook.visible.value"
      @start="startAudiobook"
    />

    <GlobalAudiobookPlayer
      :placement="toolbarVisible ? 'above-toolbar' : 'default'"
      :hidden="!audiobookEnabled || !toolbarVisible"
    />

    <view class="reader-listen-footer">
      <ReaderImmersiveListenBar
        v-if="
          audiobookEnabled &&
          showReaderControls &&
          !toolbarVisible &&
          audiobook.visible.value &&
          (audiobook.loading.value ||
            showAudiobookPlaybackControls ||
            showAudiobookOriginalProgress)
        "
        :show-original-progress="showAudiobookOriginalProgress"
        :is-on-playback-page="showAudiobookPlaybackControls"
        :playing="audiobook.playing.value"
        :loading="audiobook.loading.value"
        @locate-original="locateAudiobookProgress"
        @from-current="listenFromCurrentPage"
        @toggle-play="audiobook.togglePlay"
      />
    </view>

    <ReaderCatalogSheet
      v-if="catalogVisible"
      :book-title="bookTitle"
      :chapters="catalogChapters"
      :current-url="chapterUrl"
      :loading="catalogLoading"
      :error-message="catalogError"
      :auto-locate="catalogAutoLocate"
      @close="closeCatalog"
      @retry="retryCatalog"
      @select="selectCatalogChapter"
    />

    <ReaderSettingsSheet
      v-if="settingsVisible"
      :font-size="readerSettings.fontSize"
      :brightness="readerSettings.brightness"
      :page-mode="readerSettings.pageMode"
      :theme="resolvedTheme"
      @close="closeSettings"
      @font-size-change="changeFontSize"
      @brightness-change="changeBrightness"
      @page-mode-change="changePageMode"
      @reset="resetReaderSettings"
    />

    <view class="brightness-overlay" :style="brightnessOverlayStyle" />
  </view>
</template>

<style scoped>
.reader-page {
  position: relative;
  min-height: 100vh;
  padding: 0;
  overflow: hidden;
  color: var(--reader-ink);
  background: radial-gradient(circle at 88% 0%, var(--ambient), transparent 32%), var(--reader-bg);
}

.reader-listen-footer {
  display: flex;
  width: 100%;
  height: 90rpx;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.paged-area {
  width: 100%;
  overflow: hidden;
}

.reader-swiper {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 260px;
}

.scroll-reader {
  width: 100%;
  height: 100%;
}

.reader-state {
  display: flex;
  height: 100%;
  padding: 40rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.state-mark {
  display: grid;
  width: 92rpx;
  height: 92rpx;
  margin-bottom: 28rpx;
  color: var(--button-ink);
  background: var(--gold);
  border-radius: 24rpx;
  font-size: 42rpx;
  font-weight: 800;
  place-items: center;
}

.state-title {
  font-size: 34rpx;
  font-weight: 700;
}

.state-description {
  max-width: 560rpx;
  margin-top: 14rpx;
  color: var(--muted);
  font-size: 28rpx;
  line-height: 1.7;
}

.state-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 30rpx;
}

.state-button {
  min-width: 180rpx;
  height: 72rpx;
  margin: 0;
  padding: 0 24rpx;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 72rpx;
}

.state-button.primary {
  color: var(--button-ink);
  background: var(--gold);
  border-color: var(--gold);
  font-weight: 700;
}

.brightness-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: #000;
  pointer-events: none;
  transition: opacity 120ms ease;
}
</style>
