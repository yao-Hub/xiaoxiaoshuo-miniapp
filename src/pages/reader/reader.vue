<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onHide, onLoad, onUnload } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import ReaderBottomBar from '@/components/reader/ReaderBottomBar.vue'
import ReaderCatalogSheet from '@/components/reader/ReaderCatalogSheet.vue'
import ReaderChapterContent from '@/components/reader/ReaderChapterContent.vue'
import ReaderListenButton from '@/components/reader/ReaderListenButton.vue'
import ReaderSettingsSheet from '@/components/reader/ReaderSettingsSheet.vue'
import ReaderTopBar from '@/components/reader/ReaderTopBar.vue'
import { useAudiobook } from '@/composables/useAudiobook'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
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
import { getAuthToken, openLoginPage } from '@/services/auth'
import { trackAnalyticsEvent } from '@/services/analytics'
import type { Chapter, ChapterContent } from '@/types/novel'
import type { ReaderPageMode, ReaderSettings } from '@/types/reader'
import { getReaderLineAbsoluteOffset, splitChapterParagraphs } from '@/utils/pagination'
import { resolveHorizontalReaderTapZone, resolveReaderTapZone } from '@/utils/reader-interaction'
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

const readerSettings = reactive<ReaderSettings>(getReaderSettings())
const audiobook = useAudiobook()
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
const brightnessOverlayStyle = computed(() => ({
  opacity: String((100 - readerSettings.brightness) / 100)
}))

watch(
  () => catalogChapters.value.length,
  (chapterCount) => {
    if (chapterCount && chapter.value) {
      void refreshWindow()
    }
  }
)

onLoad(async (options) => {
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
      scrollTop: readerSettings.pageMode === 'scroll' ? scrollReaderTop.value : 0,
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
    scrollTop: readerSettings.pageMode === 'scroll' ? scrollReaderTop.value : 0,
    progress: getReadingProgress(),
    pageIndex: currentPageIndex.value,
    updatedAt: Date.now()
  })
}

function handleSwiperFinish(event: SwiperFinishEvent) {
  const nextIndex = Number(event.detail.current)
  if (!Number.isFinite(nextIndex)) {
    return
  }
  void commitSwiperIndex(nextIndex)
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

function openPreviousChapter() {
  void moveToAdjacentChapter('previous', { enterAtStart: true, instant: true })
}

function openNextChapter() {
  void moveToAdjacentChapter('next', { enterAtStart: true, instant: true })
}

function openSettings() {
  settingsVisible.value = true
}

function getCurrentPageStartOffset() {
  const currentPage = readerPages.value[currentPageIndex.value]
  const firstLine = currentPage?.lines[0]
  if (!firstLine) {
    return undefined
  }
  return getReaderLineAbsoluteOffset(chapterParagraphs.value, firstLine)
}

function startAudiobook() {
  const startOffset = getCurrentPageStartOffset()
  if (!chapter.value || startOffset === undefined) {
    uni.showToast({ title: '无法定位当前页的朗读位置', icon: 'none' })
    return false
  }
  const startOptions = {
    chapterUrl: chapter.value.chapterUrl,
    catalogUrl: effectiveCatalogUrl.value,
    bookTitle: bookTitle.value,
    title: chapter.value.title,
    coverUrl: bookCoverUrl.value,
    absoluteStartOffset: startOffset
  }
  void audiobook.start(startOptions)
  return true
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
    scrollTop: isCurrentChapter ? scrollReaderTop.value : 0
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
        :key="windowKey"
        class="reader-swiper"
        :style="{ height: `${viewport.pageViewportHeight.value}px` }"
        :current="currentSwiperIndex"
        :vertical="readerSettings.pageMode === 'vertical'"
        :duration="interactionLocked ? 0 : 260"
        :disable-touch="interactionLocked || loading"
        @tap="handleReaderTap"
        @touchstart="captureReaderTouch"
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
      @previous="openPreviousChapter"
      @next="openNextChapter"
      @catalog="openCatalog"
      @settings="openSettings"
      @toggle-theme="toggleResolvedTheme"
      @preview="previewChapter"
      @preview-end="clearChapterPreview"
      @seek="seekChapter"
    />

    <ReaderListenButton
      v-if="toolbarVisible && showReaderControls && !audiobook.visible.value"
      @start="startAudiobook"
    />

    <GlobalAudiobookPlayer
      :placement="toolbarVisible ? 'above-toolbar' : 'default'"
      :hidden="!toolbarVisible"
    />

    <!--
      <ReaderImmersiveListenBar
        v-if="showReaderControls && !toolbarVisible && audiobook.visible.value"
        :show-original-progress="showAudiobookOriginalProgress"
        :is-on-playback-page="isAudiobookOnCurrentPage"
        :playing="audiobook.playing.value"
        :loading="audiobook.loading.value"
        :error="Boolean(audiobook.errorMessage.value)"
        @locate-original="locateAudiobookProgress"
        @from-current="listenFromCurrentPage"
        @toggle-play="audiobook.togglePlay"
      />
    -->

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
