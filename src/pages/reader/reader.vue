<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onHide, onLoad, onUnload } from '@dcloudio/uni-app'
import ReaderBottomBar from '@/components/reader/ReaderBottomBar.vue'
import ReaderCatalogSheet from '@/components/reader/ReaderCatalogSheet.vue'
import ReaderChapterContent from '@/components/reader/ReaderChapterContent.vue'
import ReaderSettingsSheet from '@/components/reader/ReaderSettingsSheet.vue'
import ReaderTopBar from '@/components/reader/ReaderTopBar.vue'
import { useAdjacentChapterPreviews } from '@/composables/useAdjacentChapterPreviews'
import { useReaderCatalog } from '@/composables/useReaderCatalog'
import { useReaderChapter } from '@/composables/useReaderChapter'
import { useReaderPagination, type ReaderRestorePosition } from '@/composables/useReaderPagination'
import { useReaderViewport } from '@/composables/useReaderViewport'
import { usePageTheme } from '@/composables/useTheme'
import {
  DEFAULT_READER_SETTINGS,
  READER_BRIGHTNESS_MIN,
  READER_FONT_SIZE_MAX,
  READER_FONT_SIZE_MIN
} from '@/constants/reader'
import { getAuthToken, openLoginPage } from '@/services/auth'
import type { Chapter } from '@/types/novel'
import type { ReaderPageData, ReaderPageMode, ReaderSettings } from '@/types/reader'
import { resolveHorizontalReaderTapZone, resolveReaderTapZone } from '@/utils/reader-interaction'
import {
  getReaderSettings,
  getReadingRecord,
  rememberReading,
  saveReaderSettings,
  updateReadingProgress
} from '@/utils/storage'

interface SwiperChangeEvent {
  detail: {
    current: number
  }
}

interface ReaderScrollEvent {
  detail: {
    scrollTop: number
  }
}

interface ReaderSwiperPage {
  key: string
  chapterTitle: string
  page: ReaderPageData
}

const readerSettings = reactive<ReaderSettings>(getReaderSettings())
const viewport = useReaderViewport()
const pagination = useReaderPagination({
  settings: readerSettings,
  pageContentHeight: viewport.pageContentHeight,
  pageViewportHeight: viewport.pageViewportHeight,
  textWidthPx: viewport.textWidthPx
})
const { themeClass, resolvedTheme, toggleResolvedTheme } = usePageTheme()
const previews = useAdjacentChapterPreviews(pagination.buildPagesForChapter)
const readerChapter = useReaderChapter()
const {
  chapterUrl,
  requestedChapterUrl,
  catalogUrl,
  bookTitle,
  chapter,
  loading,
  errorMessage,
  loadChapter: requestChapter,
  cancelPendingLoad
} = readerChapter
const readerCatalog = useReaderCatalog({
  catalogUrl,
  currentChapterUrl: chapterUrl,
  bookTitle
})
const {
  chapters: catalogChapters,
  loading: catalogLoading,
  errorMessage: catalogError,
  visible: catalogVisible,
  dragPreviewIndex,
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
  resolveChapterAt
} = readerCatalog
const {
  readerPages,
  currentPageIndex,
  scrollReaderTop,
  scrollRestoreTop,
  fontSizePx,
  scrollLines,
  scrollShowHeading,
  setChapterPages,
  setScrollPosition,
  estimatePageScrollTop,
  syncPageIndexFromScroll,
  getReadingProgress
} = pagination
const {
  previousPreviewPage,
  nextPreviewPage,
  clear: clearPreviews,
  prefetch: prefetchPreviews
} = previews

const toolbarVisible = ref(false)
const settingsVisible = ref(false)
let tapStartX = 0
let tapStartY = 0
let settingsSaveTimer: ReturnType<typeof setTimeout> | undefined
let lastScrollPersistAt = 0
let lastReaderScrollAt = 0

const brightnessOverlayStyle = computed(() => ({
  opacity: String((100 - readerSettings.brightness) / 100)
}))
const showTopBar = computed(
  () => toolbarVisible.value || loading.value || Boolean(errorMessage.value)
)
const showReaderControls = computed(
  () => Boolean(chapter.value) && !loading.value && !errorMessage.value
)
const swiperPages = computed<ReaderSwiperPage[]>(() => {
  if (!chapter.value) {
    return []
  }
  const items: ReaderSwiperPage[] = []
  if (previousPreviewPage.value) {
    items.push({
      key: `preview-${previousPreviewPage.value.chapter.chapterUrl}`,
      chapterTitle: previousPreviewPage.value.chapter.title,
      page: previousPreviewPage.value.page
    })
  }
  readerPages.value.forEach((page, pageIndex) => {
    items.push({
      key: `${chapter.value?.chapterUrl}-${pageIndex}`,
      chapterTitle: chapter.value?.title || '',
      page
    })
  })
  if (nextPreviewPage.value) {
    items.push({
      key: `preview-${nextPreviewPage.value.chapter.chapterUrl}`,
      chapterTitle: nextPreviewPage.value.chapter.title,
      page: nextPreviewPage.value.page
    })
  }
  return items
})
const previousPreviewOffset = computed(() => (previousPreviewPage.value ? 1 : 0))
const currentSwiperIndex = computed(() => previousPreviewOffset.value + currentPageIndex.value)

onLoad(async (options) => {
  chapterUrl.value = decodeURIComponent(String(options?.chapterUrl || ''))
  requestedChapterUrl.value = chapterUrl.value
  catalogUrl.value = decodeURIComponent(String(options?.catalogUrl || ''))
  bookTitle.value = decodeURIComponent(String(options?.bookTitle || ''))

  if (!chapterUrl.value) {
    await requestChapter('')
    return
  }

  const savedRecord = getReadingRecord(chapterUrl.value)
  await openChapter(chapterUrl.value, {
    pageIndex: savedRecord?.pageIndex || 0,
    scrollTop: savedRecord?.scrollTop || 0
  })
})

onHide(() => {
  persistReadingProgress()
  persistReaderSettings()
})

onUnload(() => {
  persistReadingProgress()
  persistReaderSettings()
  cancelPendingLoad()
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer)
    settingsSaveTimer = undefined
  }
})

async function openChapter(targetUrl: string, restore: ReaderRestorePosition) {
  if (!targetUrl) {
    await requestChapter('')
    return false
  }
  if (chapter.value && chapter.value.chapterUrl !== targetUrl) {
    persistReadingProgress()
  }
  clearPreviews()
  const nextChapter = await requestChapter(targetUrl)
  if (!nextChapter) {
    return false
  }

  rememberReading({
    key: nextChapter.catalogUrl || nextChapter.chapterUrl,
    bookTitle: bookTitle.value || '未命名作品',
    chapterTitle: nextChapter.title,
    chapterUrl: nextChapter.chapterUrl,
    catalogUrl: nextChapter.catalogUrl,
    scrollTop: Math.max(0, restore.scrollTop || 0),
    pageIndex: restore.pageIndex === 'last' ? 0 : Math.max(0, restore.pageIndex),
    progress: 0,
    updatedAt: Date.now()
  })
  setChapterPages(nextChapter, restore)
  persistReadingProgress()
  void prefetchPreviews(nextChapter)
  void ensureCatalog()
  return true
}

function persistReadingProgress() {
  if (!chapter.value || !readerPages.value.length) {
    return
  }
  updateReadingProgress({
    chapterUrl: chapter.value.chapterUrl,
    scrollTop: readerSettings.pageMode === 'scroll' ? scrollReaderTop.value : 0,
    progress: getReadingProgress(),
    pageIndex: currentPageIndex.value,
    updatedAt: Date.now()
  })
}

function handleSwiperChange(event: SwiperChangeEvent) {
  const nextIndex = Number(event.detail.current)
  if (!Number.isFinite(nextIndex)) {
    return
  }
  if (loading.value || nextIndex === currentSwiperIndex.value) {
    return
  }
  if (previousPreviewPage.value && nextIndex === 0) {
    void openChapter(previousPreviewPage.value.chapter.chapterUrl, { pageIndex: 'last' })
    return
  }
  if (nextPreviewPage.value && nextIndex === swiperPages.value.length - 1) {
    void openChapter(nextPreviewPage.value.chapter.chapterUrl, { pageIndex: 0 })
    return
  }
  currentPageIndex.value = Math.min(
    Math.max(0, nextIndex - previousPreviewOffset.value),
    Math.max(0, readerPages.value.length - 1)
  )
  persistReadingProgress()
}

function handleScrollModeScroll(event: ReaderScrollEvent) {
  if (readerSettings.pageMode !== 'scroll') {
    return
  }
  scrollReaderTop.value = Math.max(0, event.detail.scrollTop)
  lastReaderScrollAt = Date.now()
  syncPageIndexFromScroll()

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
  turnReaderPage(zone === 'previous' ? -1 : 1)
}

function turnReaderPage(direction: -1 | 1) {
  if (direction > 0 && currentPageIndex.value >= readerPages.value.length - 1) {
    if (chapter.value?.nextUrl) {
      void openChapter(chapter.value.nextUrl, { pageIndex: 0 })
    } else {
      uni.showToast({ title: '已经是最后一章', icon: 'none' })
    }
    return
  }

  if (direction < 0 && currentPageIndex.value <= 0) {
    if (chapter.value?.prevUrl) {
      void openChapter(chapter.value.prevUrl, { pageIndex: 'last' })
    } else {
      uni.showToast({ title: '已经是第一章', icon: 'none' })
    }
    return
  }

  currentPageIndex.value = Math.min(
    Math.max(0, currentPageIndex.value + direction),
    Math.max(0, readerPages.value.length - 1)
  )
  persistReadingProgress()
}

function openCatalog() {
  persistReadingProgress()
  showCatalog()
}

function selectCatalogChapter(targetChapter: Chapter) {
  closeCatalog()
  if (targetChapter.url === chapterUrl.value) {
    currentPageIndex.value = 0
    if (readerSettings.pageMode === 'scroll') {
      setScrollPosition(0)
    }
    persistReadingProgress()
    return
  }
  void openChapter(targetChapter.url, { pageIndex: 0 })
}

function seekChapter(index: number) {
  const targetChapter = resolveChapterAt(index)
  if (!targetChapter || targetChapter.url === chapterUrl.value) {
    return
  }
  void openChapter(targetChapter.url, { pageIndex: 0 })
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

function openPreviousChapter() {
  if (chapter.value?.prevUrl) {
    void openChapter(chapter.value.prevUrl, { pageIndex: 0 })
  }
}

function openNextChapter() {
  if (chapter.value?.nextUrl) {
    void openChapter(chapter.value.nextUrl, { pageIndex: 0 })
  }
}

function openSettings() {
  settingsVisible.value = true
}

function closeSettings() {
  settingsVisible.value = false
  persistReaderSettings()
}

function changeFontSize(value: number) {
  readerSettings.fontSize = Math.min(READER_FONT_SIZE_MAX, Math.max(READER_FONT_SIZE_MIN, value))
  if (chapter.value) {
    setChapterPages(
      chapter.value,
      {
        pageIndex: currentPageIndex.value,
        scrollTop: scrollReaderTop.value
      },
      true
    )
    void prefetchPreviews(chapter.value)
  }
  persistReadingProgress()
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
    setChapterPages(
      chapter.value,
      {
        pageIndex: currentPageIndex.value,
        scrollTop: scrollReaderTop.value
      },
      true
    )
    void prefetchPreviews(chapter.value)
  }
  persistReadingProgress()
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
  try {
    saveReaderSettings({ ...readerSettings })
  } catch {
    uni.showToast({ title: '设置保存失败', icon: 'none' })
  }
}

async function retryLoad() {
  const targetUrl = requestedChapterUrl.value || chapterUrl.value
  if (!targetUrl) {
    uni.showToast({ title: '章节地址缺失，无法重试', icon: 'none' })
    return
  }
  if (!getAuthToken()) {
    const redirectUrl = `/pages/reader/reader?chapterUrl=${encodeURIComponent(targetUrl)}&catalogUrl=${encodeURIComponent(catalogUrl.value)}&bookTitle=${encodeURIComponent(bookTitle.value)}`
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
  const succeeded = await openChapter(targetUrl, {
    pageIndex: isCurrentChapter ? currentPageIndex.value : 0,
    scrollTop: isCurrentChapter ? scrollReaderTop.value : 0
  })
  uni.hideLoading()
  if (!succeeded) {
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
      :chapter-title="loading ? '正在加载' : errorMessage ? '读取失败' : chapter?.title || ''"
      :top-inset="viewport.topInset.value"
      :right-inset="viewport.rightInset.value"
      @back="goBack"
    />

    <view v-if="loading" class="reader-state">
      <view class="state-mark">西</view>
      <view class="state-title">正在加载正文</view>
      <view class="state-description">正在整理章节内容，请稍候。</view>
    </view>

    <view v-else-if="errorMessage" class="reader-state">
      <view class="state-title">正文加载失败</view>
      <view class="state-description">{{ errorMessage }}</view>
      <view class="state-actions">
        <button class="state-button" @tap.stop="goBack">返回</button>
        <button class="state-button primary" @tap.stop="retryLoad">重新加载</button>
      </view>
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
        @scroll="handleScrollModeScroll"
      >
        <ReaderChapterContent
          flow="scroll"
          :book-title="bookTitle"
          :chapter-title="chapter.title"
          :lines="scrollLines"
          :show-heading="scrollShowHeading"
          :font-size-px="fontSizePx"
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
        class="reader-swiper"
        :style="{ height: `${viewport.pageViewportHeight.value}px` }"
        :current="currentSwiperIndex"
        :vertical="readerSettings.pageMode === 'vertical'"
        :duration="260"
        @tap="handleReaderTap"
        @touchstart="captureReaderTouch"
        @change="handleSwiperChange"
      >
        <swiper-item v-for="item in swiperPages" :key="item.key">
          <ReaderChapterContent
            flow="page"
            :book-title="bookTitle"
            :chapter-title="item.chapterTitle"
            :lines="item.page.lines"
            :show-heading="item.page.showHeading"
            :font-size-px="fontSizePx"
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
      :previous-disabled="!chapter?.prevUrl"
      :next-disabled="!chapter?.nextUrl"
      @previous="openPreviousChapter"
      @next="openNextChapter"
      @catalog="openCatalog"
      @settings="openSettings"
      @toggle-theme="toggleResolvedTheme"
      @preview="previewChapter"
      @seek="seekChapter"
    />

    <ReaderCatalogSheet
      v-if="catalogVisible"
      :book-title="bookTitle"
      :chapters="catalogChapters"
      :current-url="chapterUrl"
      :loading="catalogLoading"
      :error-message="catalogError"
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
