<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import BookResultCard from '@/components/book/BookResultCard.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { searchBooks } from '@/services/novel'
import { ApiRequestError } from '@/services/http'
import { addSearchHistory } from '@/utils/storage'
import { getAuthToken, openLoginPage, openProtectedPage } from '@/services/auth'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { usePageTheme } from '@/composables/useTheme'
import { trackAnalyticsEvent } from '@/services/analytics'
import type { Book, SearchGroup, SearchMode } from '@/types/novel'

const SEARCH_MODES: Array<{ value: SearchMode; label: string }> = [
  { value: 'app', label: 'App' },
  { value: 'web', label: '网页' }
]

const query = ref('')
const inputValue = ref('')
const groups = ref<SearchGroup[]>([])
const loading = ref(false)
const errorMessage = ref('')
const searchMode = ref<SearchMode>('app')
const modeSheetVisible = ref(false)
const { themeClass } = usePageTheme()
usePageAnalytics('search')
const totalResults = computed(() =>
  groups.value.reduce((total, group) => total + group.items.length, 0)
)
const searchModeLabel = computed(
  () => SEARCH_MODES.find((mode) => mode.value === searchMode.value)?.label || 'App'
)

onLoad((options) => {
  query.value = decodeURIComponent(String(options?.q || ''))
  inputValue.value = query.value
  const requestedMode = String(options?.mode || '')
  if (SEARCH_MODES.some((mode) => mode.value === requestedMode)) {
    searchMode.value = requestedMode as SearchMode
  }
  if (query.value) {
    runSearch()
  }
})

async function runSearch(value = query.value) {
  const next = value.trim()
  if (!next) {
    return
  }
  if (!getAuthToken()) {
    promptSearchLogin(next)
    return
  }

  query.value = next
  loading.value = true
  errorMessage.value = ''
  addSearchHistory(next)

  try {
    groups.value = await searchBooks(next, searchMode.value)
    trackAnalyticsEvent('search', {
      page: 'search',
      value: totalResults.value,
      metadata: {
        query: next,
        searchMode: searchMode.value,
        resultCount: totalResults.value
      }
    })
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 401) {
      groups.value = []
      loading.value = false
      promptSearchLogin(next)
      return
    }
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

function promptSearchLogin(value: string) {
  const target = `/pages/search/search?q=${encodeURIComponent(value)}&mode=${searchMode.value}`
  uni.showModal({
    title: '请先登录',
    content: '登录后可以搜索书名。',
    confirmText: '去登录',
    cancelText: '取消',
    success(result) {
      if (result.confirm) {
        openLoginPage(target)
      }
    }
  })
}

function selectSearchMode(mode: SearchMode) {
  modeSheetVisible.value = false
  if (searchMode.value === mode) {
    return
  }
  searchMode.value = mode
  if (query.value) {
    void runSearch(inputValue.value)
  }
}

function openCatalog(book: Book) {
  trackAnalyticsEvent('book_open', {
    page: 'search',
    bookTitle: book.title,
    metadata: { source: book.source, action: 'catalog' }
  })
  openProtectedPage(
    `/pages/catalog/catalog?url=${encodeURIComponent(book.catalogUrl)}&title=${encodeURIComponent(book.title)}&coverUrl=${encodeURIComponent(book.coverUrl)}`
  )
}

function openReader(book: Book) {
  const hasDirectChapter =
    book.readUrl && book.readUrl !== book.catalogUrl && !/\/chapter\/\d+\/0\/?$/.test(book.readUrl)

  if (!hasDirectChapter) {
    openCatalog(book)
    return
  }

  trackAnalyticsEvent('reader_open', {
    page: 'search',
    bookTitle: book.title,
    chapterUrl: book.readUrl,
    metadata: { source: book.source }
  })
  openProtectedPage(
    `/pages/reader/reader?chapterUrl=${encodeURIComponent(book.readUrl)}&catalogUrl=${encodeURIComponent(book.catalogUrl)}&bookTitle=${encodeURIComponent(book.title)}&coverUrl=${encodeURIComponent(book.coverUrl)}`
  )
}
</script>

<template>
  <view class="page search-page" :class="themeClass">
    <view class="search-bar card">
      <button class="mode-trigger" @tap="modeSheetVisible = true">
        <text>{{ searchModeLabel }}</text>
        <view class="mode-chevron" />
      </button>
      <input
        v-model="inputValue"
        class="search-input"
        placeholder="搜索书名"
        placeholder-class="placeholder"
        confirm-type="search"
        @confirm="runSearch(inputValue)"
      />
      <button class="search-button" @tap="runSearch(inputValue)">搜索</button>
    </view>

    <view class="result-head">
      <view>
        <view class="result-title">“{{ query }}”</view>
        <view class="result-meta">名称完全匹配的作品优先显示</view>
      </view>
      <text class="result-count">{{ totalResults }} 本</text>
    </view>

    <view v-if="loading" class="loading-state">
      <view class="loading-list">
        <view v-for="index in 3" :key="index" class="skeleton card" />
      </view>
    </view>

    <view v-else-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <view v-else-if="!groups.length" class="empty">没有找到相关作品</view>

    <view v-else class="group-list">
      <view v-for="group in groups" :key="group.source" class="source-group">
        <view class="group-head">
          <text class="group-name">{{ group.label }}</text>
          <text class="group-count">{{ group.items.length }}</text>
        </view>

        <view v-if="group.error" class="group-error card">{{ group.error }}</view>
        <view v-else-if="!group.items.length" class="group-empty card">没有找到相关作品</view>

        <view v-else class="book-list">
          <BookResultCard
            v-for="book in group.items"
            :key="book.id"
            :book="book"
            @catalog="openCatalog"
            @reader="openReader"
          />
        </view>
      </view>
    </view>

    <BottomSheet
      v-if="modeSheetVisible"
      :show-handle="false"
      :z-index="120"
      @close="modeSheetVisible = false"
    >
      <view class="mode-sheet-heading">
        <button
          class="mode-sheet-back"
          aria-label="关闭搜索来源选择"
          @tap="modeSheetVisible = false"
        >
          <view class="mode-sheet-back-icon" />
        </button>
        <text class="mode-sheet-title">搜索来源</text>
        <view class="mode-sheet-spacer" />
      </view>
      <view class="mode-sheet-options">
        <button
          v-for="option in SEARCH_MODES"
          :key="option.value"
          class="mode-sheet-option"
          :class="{ selected: searchMode === option.value }"
          @tap="selectSearchMode(option.value)"
        >
          {{ option.label }}
        </button>
      </view>
    </BottomSheet>

    <GlobalAudiobookPlayer />
  </view>
</template>

<style scoped>
.search-page {
  padding-top: 24rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 10rpx;
}

.mode-trigger {
  display: flex;
  width: 116rpx;
  height: 76rpx;
  margin: 0 12rpx 0 0;
  padding: 0 14rpx;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 116rpx;
  color: var(--ink);
  background: var(--input-bg);
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 76rpx;
}

.mode-chevron,
.mode-sheet-back-icon {
  width: 12rpx;
  height: 12rpx;
  border-right: 2rpx solid currentColor;
  border-bottom: 2rpx solid currentColor;
}

.mode-chevron {
  transform: translateY(-3rpx) rotate(45deg);
}

.mode-sheet-back-icon {
  transform: rotate(135deg);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 76rpx;
  padding: 0 20rpx;
  color: var(--ink);
  font-size: 30rpx;
}

.placeholder {
  color: var(--muted);
}

.search-button {
  width: 130rpx;
  height: 76rpx;
  margin: 0;
  color: var(--button-ink);
  background: var(--gold);
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 76rpx;
}

.result-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 42rpx 4rpx 24rpx;
}

.result-title {
  font-size: 40rpx;
  font-weight: 800;
}

.result-meta {
  margin-top: 8rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.result-count {
  color: var(--gold);
  font-size: 28rpx;
}

.group-list,
.book-list,
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.source-group {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18rpx 4rpx 2rpx;
}

.group-name {
  font-size: 31rpx;
  font-weight: 800;
}

.group-count {
  min-width: 42rpx;
  padding: 4rpx 12rpx;
  color: var(--muted);
  border: 1rpx solid var(--line);
  border-radius: 999rpx;
  text-align: center;
  font-size: 28rpx;
}

.group-error {
  padding: 24rpx;
  color: var(--danger);
  font-size: 28rpx;
  line-height: 1.6;
}

.group-empty {
  padding: 24rpx;
  color: var(--muted);
  text-align: center;
  font-size: 28rpx;
}

.skeleton {
  height: 200rpx;
  background: linear-gradient(
    100deg,
    var(--skeleton-a) 20%,
    var(--skeleton-b) 38%,
    var(--skeleton-a) 56%
  );
  background-size: 200% 100%;
}

.mode-sheet-heading {
  display: grid;
  grid-template-columns: 72rpx 1fr 72rpx;
  min-height: 96rpx;
  align-items: center;
}

.mode-sheet-back {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--reader-ink);
  background: transparent;
  line-height: 64rpx;
}

.mode-sheet-title {
  color: var(--reader-ink);
  text-align: center;
  font-size: 34rpx;
  font-weight: 800;
}

.mode-sheet-spacer {
  width: 64rpx;
}

.mode-sheet-options {
  display: flex;
  padding: 20rpx 0 10rpx;
  flex-direction: column;
  gap: 14rpx;
}

.mode-sheet-option {
  width: 100%;
  height: 92rpx;
  margin: 0;
  padding: 0 26rpx;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid transparent;
  border-radius: 18rpx;
  font-size: 31rpx;
  line-height: 92rpx;
  text-align: left;
}

.mode-sheet-option.selected {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
  font-weight: 700;
}
</style>
