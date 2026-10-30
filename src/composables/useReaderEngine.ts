import { computed, nextTick, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { loadChapterWithCache } from '@/services/chapter-cache'
import type { ChapterContent } from '@/types/novel'
import type { ReaderChapterBlock, ReaderPageData, ReaderSettings } from '@/types/reader'
import { buildReaderPages, estimateTextLines, splitChapterParagraphs } from '@/utils/pagination'

const READER_LINE_HEIGHT = 1.95
const READER_TITLE_LINE_HEIGHT = 1.4
const READER_TITLE_SCALE = 1.35
const SWIPER_UNLOCK_DELAY = 320

interface ReaderWindowState {
  blocks: ReaderChapterBlock[]
  activeBlockIndex: number
  currentPageIndex: number
}

interface AdjacentChapterUrls {
  previousUrl: string
  nextUrl: string
}

interface MoveToAdjacentChapterOptions {
  instant?: boolean
  enterAtStart?: boolean
}

interface ReaderEngineOptions {
  settings: ReaderSettings
  pageContentHeight: MaybeRefOrGetter<number>
  pageViewportHeight: MaybeRefOrGetter<number>
  textWidthPx: number
  getAdjacentUrls: (chapter: ChapterContent) => AdjacentChapterUrls
  onChapterCommitted?: (chapter: ChapterContent, pageIndex: number) => void
}

export interface ReaderRestorePosition {
  pageIndex: number | 'last'
  scrollTop?: number
}

export interface ReaderSwiperPage {
  key: string
  chapterTitle: string
  page: ReaderPageData
  blockIndex: number
  pageIndex: number
}

const EMPTY_WINDOW: ReaderWindowState = {
  blocks: [],
  activeBlockIndex: 0,
  currentPageIndex: 0
}

export function useReaderEngine(options: ReaderEngineOptions) {
  const windowState = ref<ReaderWindowState>({ ...EMPTY_WINDOW })
  const requestedChapterUrl = ref('')
  const loading = ref(true)
  const errorMessage = ref('')
  const interactionLocked = ref(false)
  const windowKey = ref(0)
  const scrollReaderTop = ref(0)
  const scrollRestoreTop = ref(0)
  const scrollProgress = ref(0)
  let activeRequestId = 0
  let preloadGeneration = 0
  let pendingWindowRefresh = false
  let unlockTimer: ReturnType<typeof setTimeout> | undefined

  const fontSizePx = computed(() => uni.upx2px(options.settings.fontSize * 2))
  const letterSpacingPx = computed(() => uni.upx2px(1))
  const paragraphGapPx = computed(() => uni.upx2px(30))
  const lineHeightPx = computed(() => fontSizePx.value * READER_LINE_HEIGHT)
  const blocks = computed(() => windowState.value.blocks)
  const activeBlock = computed(() => blocks.value[windowState.value.activeBlockIndex])
  const chapter = computed(() => activeBlock.value?.chapter)
  const chapterUrl = computed(() => chapter.value?.chapterUrl || '')
  const catalogUrl = computed(() => chapter.value?.catalogUrl || '')
  const readerPages = computed(() => activeBlock.value?.pages || [])
  const currentPageIndex = computed(() => windowState.value.currentPageIndex)
  const swiperPages = computed<ReaderSwiperPage[]>(() =>
    blocks.value.flatMap((block, blockIndex) =>
      block.pages.map((page, pageIndex) => ({
        key: `${block.key}-${pageIndex}`,
        chapterTitle: block.chapter.title,
        page,
        blockIndex,
        pageIndex
      }))
    )
  )
  const blockOffsets = computed(() => {
    let offset = 0
    return blocks.value.map((block) => {
      const currentOffset = offset
      offset += block.pages.length
      return currentOffset
    })
  })
  const currentSwiperIndex = computed(
    () => (blockOffsets.value[windowState.value.activeBlockIndex] || 0) + currentPageIndex.value
  )
  const previousChapterUrl = computed(() =>
    chapter.value ? options.getAdjacentUrls(chapter.value).previousUrl : ''
  )
  const nextChapterUrl = computed(() =>
    chapter.value ? options.getAdjacentUrls(chapter.value).nextUrl : ''
  )
  const scrollLines = computed(() => readerPages.value.flatMap((page) => page.lines))
  const scrollShowHeading = computed(() => Boolean(readerPages.value[0]?.showHeading))
  const headingHeightPx = computed(() =>
    chapter.value ? headingHeightFor(chapter.value.title) : 0
  )
  const estimatedScrollHeight = computed(
    () =>
      (scrollShowHeading.value ? headingHeightPx.value : 0) +
      scrollLines.value.reduce(
        (height, line) =>
          height + lineHeightPx.value + (line.paragraphEnd ? paragraphGapPx.value : 0),
        0
      )
  )

  function clearUnlockTimer() {
    if (unlockTimer) {
      clearTimeout(unlockTimer)
      unlockTimer = undefined
    }
  }

  function lockInteraction() {
    clearUnlockTimer()
    interactionLocked.value = true
  }

  function scheduleUnlock() {
    unlockTimer = setTimeout(() => {
      interactionLocked.value = false
      unlockTimer = undefined
    }, SWIPER_UNLOCK_DELAY)
  }

  async function finishInteractionLock() {
    await nextTick()
    scheduleUnlock()
  }

  function headingHeightFor(title: string) {
    const bookFontSizePx = uni.upx2px(28)
    const titleFontSizePx = fontSizePx.value * READER_TITLE_SCALE
    const titleLines = estimateTextLines(title, options.textWidthPx, titleFontSizePx)
    return (
      bookFontSizePx * READER_LINE_HEIGHT +
      uni.upx2px(18) +
      titleLines * titleFontSizePx * READER_TITLE_LINE_HEIGHT +
      uni.upx2px(73)
    )
  }

  function buildPagesForChapter(chapterContent: ChapterContent) {
    return buildReaderPages(splitChapterParagraphs(chapterContent.content), {
      textWidthPx: options.textWidthPx,
      pageHeightPx: toValue(options.pageContentHeight),
      fontSizePx: fontSizePx.value,
      letterSpacingPx: letterSpacingPx.value,
      lineHeight: READER_LINE_HEIGHT,
      paragraphGapPx: paragraphGapPx.value,
      headingHeightPx: headingHeightFor(chapterContent.title)
    })
  }

  function createBlock(chapterContent: ChapterContent): ReaderChapterBlock {
    return {
      chapter: chapterContent,
      pages: buildPagesForChapter(chapterContent),
      key: chapterContent.chapterUrl
    }
  }

  function restorePageIndex(pages: ReaderPageData[], restore: ReaderRestorePosition) {
    if (restore.pageIndex === 'last') {
      return Math.max(0, pages.length - 1)
    }
    return Math.min(Math.max(0, restore.pageIndex), Math.max(0, pages.length - 1))
  }

  function notifyChapterCommitted() {
    if (chapter.value) {
      options.onChapterCommitted?.(chapter.value, currentPageIndex.value)
    }
  }

  async function loadDirectChapter(targetUrl: string, restore: ReaderRestorePosition) {
    const normalizedUrl = targetUrl.trim()
    requestedChapterUrl.value = normalizedUrl
    if (!normalizedUrl) {
      loading.value = false
      errorMessage.value = '缺少章节地址'
      return false
    }

    const requestId = ++activeRequestId
    preloadGeneration += 1
    loading.value = true
    errorMessage.value = ''
    try {
      const nextChapter = await loadChapterWithCache(normalizedUrl)
      if (requestId !== activeRequestId) {
        return false
      }

      const block = createBlock(nextChapter)
      const pageIndex = restorePageIndex(block.pages, restore)
      windowState.value = {
        blocks: [block],
        activeBlockIndex: 0,
        currentPageIndex: pageIndex
      }
      windowKey.value += 1
      requestedChapterUrl.value = nextChapter.chapterUrl
      loading.value = false
      if (options.settings.pageMode === 'scroll') {
        setScrollPosition(restore.scrollTop || estimatePageScrollTop(pageIndex))
      }
      notifyChapterCommitted()
      return true
    } catch (error) {
      if (requestId !== activeRequestId) {
        return false
      }
      const message = error instanceof Error ? error.message.trim() : ''
      errorMessage.value = message || '请求失败，请检查网络后重试'
      loading.value = false
      return false
    }
  }

  async function loadAdjacentBlock(url: string, generation: number) {
    if (!url) {
      return undefined
    }
    try {
      const adjacentChapter = await loadChapterWithCache(url)
      if (generation !== preloadGeneration) {
        return undefined
      }
      return createBlock(adjacentChapter)
    } catch {
      return undefined
    }
  }

  async function refreshWindow() {
    const sourceBlock = activeBlock.value
    if (!sourceBlock || loading.value) {
      return
    }

    const generation = ++preloadGeneration
    const sourceUrl = sourceBlock.chapter.chapterUrl
    const adjacentUrls = options.getAdjacentUrls(sourceBlock.chapter)
    const [previous, next] = await Promise.all([
      loadAdjacentBlock(adjacentUrls.previousUrl, generation),
      loadAdjacentBlock(adjacentUrls.nextUrl, generation)
    ])
    if (
      generation !== preloadGeneration ||
      chapter.value?.chapterUrl !== sourceUrl ||
      windowState.value.activeBlockIndex < 0
    ) {
      return
    }

    const nextBlocks = [...(previous ? [previous] : []), sourceBlock, ...(next ? [next] : [])]
    const nextKeys = nextBlocks.map((block) => block.key).join('|')
    const currentKeys = blocks.value.map((block) => block.key).join('|')
    if (nextKeys === currentKeys) {
      return
    }

    lockInteraction()
    windowState.value = {
      blocks: nextBlocks,
      activeBlockIndex: previous ? 1 : 0,
      currentPageIndex: currentPageIndex.value
    }
    await finishInteractionLock()
  }

  function setPageIndex(pageIndex: number) {
    const pages = readerPages.value
    if (!pages.length) {
      return
    }
    const nextPageIndex = Math.min(Math.max(0, pageIndex), pages.length - 1)
    if (nextPageIndex === currentPageIndex.value) {
      return
    }
    windowState.value = {
      ...windowState.value,
      currentPageIndex: nextPageIndex
    }
    if (options.settings.pageMode === 'scroll') {
      setScrollPosition(estimatePageScrollTop(nextPageIndex))
    }
    notifyChapterCommitted()
  }

  async function commitSwiperIndex(swiperIndex: number) {
    const target = swiperPages.value[swiperIndex]
    if (!target || interactionLocked.value || loading.value) {
      return false
    }
    if (target.blockIndex === windowState.value.activeBlockIndex) {
      setPageIndex(target.pageIndex)
      if (pendingWindowRefresh) {
        pendingWindowRefresh = false
        void refreshWindow()
      }
      return true
    }

    windowState.value = {
      blocks: blocks.value,
      activeBlockIndex: target.blockIndex,
      currentPageIndex: target.pageIndex
    }
    if (options.settings.pageMode === 'scroll') {
      setScrollPosition(estimatePageScrollTop(target.pageIndex))
    }
    notifyChapterCommitted()
    void refreshWindow()
    return true
  }

  function findBlockIndex(chapterUrlValue: string) {
    return blocks.value.findIndex((block) => block.chapter.chapterUrl === chapterUrlValue)
  }

  async function moveToAdjacentChapter(
    direction: 'previous' | 'next',
    navigation: MoveToAdjacentChapterOptions = {}
  ) {
    if (interactionLocked.value || loading.value) {
      return false
    }
    const { instant = false, enterAtStart = direction === 'next' } = navigation
    const targetUrl = direction === 'next' ? nextChapterUrl.value : previousChapterUrl.value
    if (!targetUrl) {
      return false
    }

    let targetIndex = findBlockIndex(targetUrl)
    if (targetIndex < 0) {
      await refreshWindow()
      targetIndex = findBlockIndex(targetUrl)
    }
    if (targetIndex < 0) {
      return false
    }

    const targetBlock = blocks.value[targetIndex]
    const targetPageIndex = enterAtStart ? 0 : Math.max(0, targetBlock.pages.length - 1)
    if (instant) {
      lockInteraction()
    }
    windowState.value = {
      blocks: blocks.value,
      activeBlockIndex: targetIndex,
      currentPageIndex: targetPageIndex
    }
    if (options.settings.pageMode === 'scroll') {
      setScrollPosition(estimatePageScrollTop(targetPageIndex))
    }
    notifyChapterCommitted()
    if (instant) {
      await finishInteractionLock()
      void refreshWindow()
    } else {
      pendingWindowRefresh = true
    }
    return true
  }

  async function turnPage(direction: -1 | 1) {
    const pages = readerPages.value
    const nextPageIndex = currentPageIndex.value + direction
    if (nextPageIndex >= 0 && nextPageIndex < pages.length) {
      setPageIndex(nextPageIndex)
      return true
    }
    return moveToAdjacentChapter(direction > 0 ? 'next' : 'previous')
  }

  function rebuildPages() {
    const active = activeBlock.value
    if (!active) {
      return
    }
    const previousProgress =
      active.pages.length > 1 ? currentPageIndex.value / (active.pages.length - 1) : 0
    lockInteraction()
    const nextBlocks = blocks.value.map((block) => ({
      ...block,
      pages: buildPagesForChapter(block.chapter)
    }))
    const currentBlock = nextBlocks[windowState.value.activeBlockIndex]
    const nextPageIndex =
      currentBlock.pages.length > 1
        ? Math.round(previousProgress * (currentBlock.pages.length - 1))
        : 0
    windowState.value = {
      blocks: nextBlocks,
      activeBlockIndex: windowState.value.activeBlockIndex,
      currentPageIndex: nextPageIndex
    }
    if (options.settings.pageMode === 'scroll') {
      setScrollPosition(estimatePageScrollTop(nextPageIndex))
    }
    notifyChapterCommitted()
    void finishInteractionLock()
    void refreshWindow()
  }

  function setScrollPosition(value: number) {
    const next = Math.min(
      Math.max(0, value),
      Math.max(0, estimatedScrollHeight.value - toValue(options.pageViewportHeight))
    )
    scrollReaderTop.value = next
    scrollRestoreTop.value = next
    syncPageIndexFromScroll()
  }

  function estimatePageScrollTop(pageIndex: number) {
    if (pageIndex <= 0) {
      return 0
    }
    let height = 0
    readerPages.value.slice(0, pageIndex).forEach((page) => {
      page.lines.forEach((line) => {
        height += lineHeightPx.value + (line.paragraphEnd ? paragraphGapPx.value : 0)
      })
    })
    return Math.min(
      height,
      Math.max(0, estimatedScrollHeight.value - toValue(options.pageViewportHeight))
    )
  }

  function estimateScrollTopForReaderPosition(paragraphIndex: number, startOffset: number) {
    const lines = scrollLines.value
    const lineIndex = lines.findIndex(
      (line) =>
        line.paragraphIndex === paragraphIndex &&
        startOffset >= line.lineStartOffset &&
        startOffset < line.lineEndOffset
    )
    if (lineIndex < 0) {
      return undefined
    }

    let lineTop = scrollShowHeading.value ? headingHeightPx.value : 0
    for (let index = 0; index < lineIndex; index += 1) {
      const line = lines[index]
      lineTop += lineHeightPx.value + (line.paragraphEnd ? paragraphGapPx.value : 0)
    }

    const lineCenter = lineTop + lineHeightPx.value / 2
    const target = lineCenter - toValue(options.pageViewportHeight) / 2
    return Math.min(
      Math.max(0, target),
      Math.max(0, estimatedScrollHeight.value - toValue(options.pageViewportHeight))
    )
  }

  function syncPageIndexFromScroll() {
    const maximum = Math.max(0, estimatedScrollHeight.value - toValue(options.pageViewportHeight))
    if (maximum === 0) {
      scrollProgress.value = 100
      if (readerPages.value.length) {
        windowState.value = {
          ...windowState.value,
          currentPageIndex: readerPages.value.length - 1
        }
      }
      return
    }
    const ratio = Math.min(1, scrollReaderTop.value / maximum)
    scrollProgress.value = Math.round(ratio * 100)
    if (readerPages.value.length) {
      windowState.value = {
        ...windowState.value,
        currentPageIndex: Math.round(ratio * Math.max(0, readerPages.value.length - 1))
      }
    }
  }

  function getReadingProgress() {
    if (options.settings.pageMode === 'scroll') {
      return scrollProgress.value
    }
    return readerPages.value.length <= 1
      ? 100
      : Math.round((currentPageIndex.value / (readerPages.value.length - 1)) * 100)
  }

  function cancelPendingLoad() {
    activeRequestId += 1
    preloadGeneration += 1
    loading.value = false
    clearUnlockTimer()
  }

  onScopeDispose(clearUnlockTimer)

  return {
    windowKey,
    blocks,
    activeBlockIndex: computed(() => windowState.value.activeBlockIndex),
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
    scrollLines,
    scrollShowHeading,
    loadDirectChapter,
    refreshWindow,
    commitSwiperIndex,
    moveToAdjacentChapter,
    turnPage,
    setPageIndex,
    rebuildPages,
    setScrollPosition,
    estimatePageScrollTop,
    estimateScrollTopForReaderPosition,
    syncPageIndexFromScroll,
    getReadingProgress,
    cancelPendingLoad
  }
}
