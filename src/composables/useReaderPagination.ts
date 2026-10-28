import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { ChapterContent } from '@/types/novel'
import type { ReaderPageData, ReaderSettings } from '@/types/reader'
import { buildReaderPages, estimateTextLines, splitChapterParagraphs } from '@/utils/pagination'

const READER_LINE_HEIGHT = 1.95
const READER_TITLE_LINE_HEIGHT = 1.4
const READER_TITLE_SCALE = 1.35

export interface ReaderRestorePosition {
  pageIndex: number | 'last'
  scrollTop?: number
}

interface ReaderPaginationOptions {
  settings: ReaderSettings
  pageContentHeight: MaybeRefOrGetter<number>
  pageViewportHeight: MaybeRefOrGetter<number>
  textWidthPx: number
}

export function useReaderPagination(options: ReaderPaginationOptions) {
  const readerPages = ref<ReaderPageData[]>([])
  const currentPageIndex = ref(0)
  const scrollReaderTop = ref(0)
  const scrollRestoreTop = ref(0)
  const scrollProgress = ref(0)
  const headingHeightPx = ref(0)

  const fontSizePx = computed(() => uni.upx2px(options.settings.fontSize * 2))
  const letterSpacingPx = computed(() => uni.upx2px(1))
  const paragraphGapPx = computed(() => uni.upx2px(30))
  const lineHeightPx = computed(() => fontSizePx.value * READER_LINE_HEIGHT)
  const scrollLines = computed(() => readerPages.value.flatMap((page) => page.lines))
  const scrollShowHeading = computed(() => Boolean(readerPages.value[0]?.showHeading))

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

  function buildPagesForChapter(
    chapter: ChapterContent,
    headingHeightPx = headingHeightFor(chapter.title)
  ) {
    return buildReaderPages(splitChapterParagraphs(chapter.content), {
      textWidthPx: options.textWidthPx,
      pageHeightPx: toValue(options.pageContentHeight),
      fontSizePx: fontSizePx.value,
      letterSpacingPx: letterSpacingPx.value,
      lineHeight: READER_LINE_HEIGHT,
      paragraphGapPx: paragraphGapPx.value,
      headingHeightPx
    })
  }

  const estimatedScrollHeight = computed(
    () =>
      (scrollShowHeading.value ? headingHeightPx.value : 0) +
      scrollLines.value.reduce(
        (height, line) =>
          height + lineHeightPx.value + (line.paragraphEnd ? paragraphGapPx.value : 0),
        0
      )
  )

  function clampPageIndex(value: number) {
    return Math.min(Math.max(0, value), Math.max(0, readerPages.value.length - 1))
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

  function setChapterPages(
    chapter: ChapterContent,
    restore: ReaderRestorePosition,
    preserveProgress = false
  ) {
    const previousProgress =
      preserveProgress && readerPages.value.length > 1
        ? currentPageIndex.value / (readerPages.value.length - 1)
        : 0
    const nextHeadingHeightPx = headingHeightFor(chapter.title)
    headingHeightPx.value = nextHeadingHeightPx
    const pages = buildPagesForChapter(chapter, nextHeadingHeightPx)
    readerPages.value = pages

    if (preserveProgress) {
      currentPageIndex.value = Math.round(previousProgress * Math.max(0, pages.length - 1))
    } else if (restore.pageIndex === 'last') {
      currentPageIndex.value = Math.max(0, pages.length - 1)
    } else {
      currentPageIndex.value = clampPageIndex(restore.pageIndex)
    }

    if (options.settings.pageMode === 'scroll') {
      setScrollPosition(
        preserveProgress
          ? estimatePageScrollTop(currentPageIndex.value)
          : Math.max(0, restore.scrollTop || 0)
      )
    }
    return pages
  }

  function syncPageIndexFromScroll() {
    const maximum = Math.max(0, estimatedScrollHeight.value - toValue(options.pageViewportHeight))
    if (maximum === 0) {
      scrollProgress.value = 100
      currentPageIndex.value = Math.max(0, readerPages.value.length - 1)
      return
    }
    const ratio = Math.min(1, scrollReaderTop.value / maximum)
    scrollProgress.value = Math.round(ratio * 100)
    currentPageIndex.value = Math.round(ratio * Math.max(0, readerPages.value.length - 1))
  }

  function getReadingProgress() {
    if (options.settings.pageMode === 'scroll') {
      return scrollProgress.value
    }
    return readerPages.value.length <= 1
      ? 100
      : Math.round((currentPageIndex.value / (readerPages.value.length - 1)) * 100)
  }

  return {
    readerPages,
    currentPageIndex,
    scrollReaderTop,
    scrollRestoreTop,
    fontSizePx,
    scrollLines,
    scrollShowHeading,
    buildPagesForChapter,
    setChapterPages,
    setScrollPosition,
    estimatePageScrollTop,
    syncPageIndexFromScroll,
    getReadingProgress
  }
}
