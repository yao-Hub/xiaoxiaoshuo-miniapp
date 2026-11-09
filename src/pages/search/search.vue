<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import BookResultCard from '@/components/book/BookResultCard.vue'
import { searchBooks } from '@/services/novel'
import { ApiRequestError } from '@/services/http'
import { addSearchHistory } from '@/utils/storage'
import { ensureUserSession, openProtectedPage } from '@/services/auth'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { usePageTheme } from '@/composables/useTheme'
import { trackAnalyticsEvent } from '@/services/analytics'
import type { Book } from '@/types/novel'

const DISPLAY_MODE_STORAGE_KEY = 'xiaoxiaoshuo.searchDisplayMode'
const SEARCH_PAGE_SIZE = 20
const query = ref('')
const inputValue = ref('')
const books = ref<Book[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref('')
const page = ref(1)
const hasMore = ref(false)
const showBackToTop = ref(false)
const displayMode = ref<'list' | 'grid'>(readDisplayMode())
const bookColumns = computed(() => [
  books.value.filter((_, index) => index % 2 === 0),
  books.value.filter((_, index) => index % 2 === 1)
])
const { themeClass } = usePageTheme()
usePageAnalytics('search')

function readDisplayMode(): 'list' | 'grid' {
  return uni.getStorageSync(DISPLAY_MODE_STORAGE_KEY) === 'list' ? 'list' : 'grid'
}

onShow(() => {
  displayMode.value = readDisplayMode()
})

onLoad((options) => {
  query.value = decodeURIComponent(String(options?.q || ''))
  inputValue.value = query.value
  if (query.value) {
    void runSearch()
  }
})

async function requestSearchPage(value: string, nextPage: number) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await ensureUserSession()
    try {
      return await searchBooks(value, nextPage, SEARCH_PAGE_SIZE)
    } catch (error) {
      if (attempt === 0 && error instanceof ApiRequestError && error.statusCode === 401) {
        continue
      }
      throw error
    }
  }
  throw new Error('搜索失败，请稍后重试')
}

async function runSearch(value = query.value) {
  const next = value.trim()
  if (!next) {
    return
  }

  query.value = next
  loading.value = true
  errorMessage.value = ''
  page.value = 1
  hasMore.value = false

  try {
    const result = await requestSearchPage(next, 1)
    books.value = result.items
    hasMore.value = result.hasMore
    addSearchHistory(next)
    trackAnalyticsEvent('search', {
      page: 'search',
      value: books.value.length,
      metadata: {
        query: next,
        resultCount: books.value.length,
        freeResultCount: books.value.length,
        hasFreeFullBook: books.value.length > 0,
        sources: [...new Set(books.value.map((book) => book.source))]
      }
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!query.value || loading.value || loadingMore.value || !hasMore.value) {
    return
  }
  loadingMore.value = true
  try {
    const result = await requestSearchPage(query.value, page.value + 1)
    const existingIds = new Set(books.value.map((book) => book.id))
    const newBooks = result.items.filter((book) => !existingIds.has(book.id))
    books.value.push(...newBooks)
    page.value = result.page
    hasMore.value = result.hasMore && newBooks.length > 0
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败，请稍后重试',
      icon: 'none'
    })
  } finally {
    loadingMore.value = false
  }
}

onReachBottom(loadMore)

onPageScroll(({ scrollTop }) => {
  showBackToTop.value = scrollTop > 400
})

function toggleDisplayMode() {
  displayMode.value = displayMode.value === 'list' ? 'grid' : 'list'
  uni.setStorageSync(DISPLAY_MODE_STORAGE_KEY, displayMode.value)
}

function scrollToTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 260
  })
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

function openBook(book: Book) {
  if (book.catalogUrl) {
    openCatalog(book)
    return
  }
  const hasDirectChapter =
    book.readUrl && book.readUrl !== book.catalogUrl && !/\/chapter\/\d+\/0\/?$/.test(book.readUrl)

  if (!hasDirectChapter) {
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
      <input
        v-model="inputValue"
        class="search-input"
        placeholder="搜索书名"
        placeholder-class="placeholder"
        confirm-type="search"
        @confirm="runSearch(inputValue)"
      />
      <button class="search-button" @tap="runSearch(inputValue)">搜索</button>
      <button
        class="display-mode-button"
        :aria-label="displayMode === 'list' ? '切换为双列显示' : '切换为列表显示'"
        @tap="toggleDisplayMode"
      >
        <view class="display-mode-icon" :class="`display-mode-icon--${displayMode}`">
          <view v-for="index in 4" :key="index" class="display-mode-part" />
        </view>
      </button>
    </view>

    <view v-if="loading" class="loading-list" :class="{ 'loading-list--grid': displayMode === 'grid' }">
      <view v-for="index in 3" :key="index" class="skeleton card" />
    </view>

    <view v-else-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <view v-else-if="!books.length" class="empty">没有找到相关作品</view>

    <view v-else-if="displayMode === 'grid'" class="book-masonry">
      <view
        v-for="(column, columnIndex) in bookColumns"
        :key="columnIndex"
        class="book-masonry-column"
      >
        <BookResultCard
          v-for="book in column"
          :key="book.id"
          :book="book"
          variant="grid"
          @open="openBook"
        />
      </view>
    </view>

    <view v-else class="book-list">
      <BookResultCard
        v-for="book in books"
        :key="book.id"
        :book="book"
        variant="list"
        @open="openBook"
      />
    </view>

    <view
      v-if="!loading && !errorMessage && books.length"
      class="end-of-list"
      @tap="loadMore"
    >
      {{ loadingMore ? '正在加载更多…' : hasMore ? '上拉加载更多' : '没有更多了' }}
    </view>

    <button
      v-if="showBackToTop"
      class="back-to-top"
      aria-label="回到顶部"
      @tap="scrollToTop"
    >
      <view class="back-to-top-icon" />
    </button>

    <GlobalAudiobookPlayer />
  </view>
</template>

<style scoped>
.search-page {
  padding: 0 0 48rpx;
}

.search-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  width: 100%;
  margin: 0;
  align-items: center;
  padding: 10rpx 28rpx;
  background: var(--card-bg, var(--surface));
  border-width: 0 0 1rpx;
  border-radius: 0;
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.18);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  padding: 0 22rpx;
  color: var(--ink);
  background: var(--input-bg);
  border: 1rpx solid var(--line);
  border-radius: 16rpx;
  font-size: 30rpx;
}

.placeholder {
  color: var(--muted);
}

.search-button {
  width: 104rpx;
  height: 72rpx;
  margin: 0 0 0 6rpx;
  padding: 0;
  color: var(--gold);
  background: transparent;
  border-radius: 0;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 72rpx;
}

.display-mode-button {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  margin: 0 0 0 8rpx;
  padding: 0;
  align-items: center;
  justify-content: center;
  flex: 0 0 72rpx;
  color: var(--ink);
  background: transparent;
  border-radius: 14rpx;
  line-height: 72rpx;
}

.display-mode-icon {
  display: grid;
  width: 34rpx;
  height: 34rpx;
  gap: 5rpx;
}

.display-mode-icon--list {
  grid-template-columns: 1fr;
}

.display-mode-icon--grid {
  grid-template-columns: repeat(2, 1fr);
}

.display-mode-part {
  background: currentColor;
  border-radius: 2rpx;
}

.display-mode-icon--list .display-mode-part:nth-child(4) {
  display: none;
}

.display-mode-icon--list .display-mode-part {
  height: 5rpx;
}

.book-list,
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 0 28rpx;
}

.loading-list--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.book-masonry {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 0 28rpx;
}

.book-masonry-column {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 18rpx;
}

.loading-list--grid .skeleton {
  height: 480rpx;
}

.loading-list {
  margin-top: 22rpx;
}

.book-list {
  margin-top: 22rpx;
}

.end-of-list {
  padding: 34rpx 0 18rpx;
  color: var(--muted);
  text-align: center;
  font-size: 24rpx;
}

.back-to-top {
  position: fixed;
  right: 28rpx;
  bottom: calc(42rpx + env(safe-area-inset-bottom));
  z-index: 30;
  display: flex;
  width: 80rpx;
  height: 80rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 50%;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.28);
  line-height: 80rpx;
}

.back-to-top-icon {
  width: 18rpx;
  height: 18rpx;
  margin-top: 8rpx;
  border-top: 4rpx solid currentColor;
  border-left: 4rpx solid currentColor;
  transform: rotate(45deg);
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
</style>
