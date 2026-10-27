<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ApiRequestError, searchBooks } from '@/services/novel'
import { addSearchHistory } from '@/utils/storage'
import { getAuthToken, openLoginPage, openProtectedPage } from '@/services/auth'
import type { Book, SearchGroup } from '@/types/novel'

const query = ref('')
const inputValue = ref('')
const groups = ref<SearchGroup[]>([])
const loading = ref(false)
const errorMessage = ref('')
const failedCovers = reactive<Record<string, boolean>>({})
const totalResults = computed(() =>
  groups.value.reduce((total, group) => total + group.items.length, 0)
)

onLoad((options) => {
  query.value = decodeURIComponent(String(options?.q || ''))
  inputValue.value = query.value
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
    groups.value = await searchBooks(next)
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
  const target = `/pages/search/search?q=${encodeURIComponent(value)}`
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

function openCatalog(book: Book) {
  openProtectedPage(
    `/pages/catalog/catalog?url=${encodeURIComponent(book.catalogUrl)}&title=${encodeURIComponent(book.title)}`
  )
}

function openReader(book: Book) {
  const hasDirectChapter =
    book.readUrl &&
    book.readUrl !== book.catalogUrl &&
    !/\/chapter\/\d+\/0\/?$/.test(book.readUrl)

  if (!hasDirectChapter) {
    openCatalog(book)
    return
  }

  openProtectedPage(
    `/pages/reader/reader?chapterUrl=${encodeURIComponent(book.readUrl)}&catalogUrl=${encodeURIComponent(book.catalogUrl)}&bookTitle=${encodeURIComponent(book.title)}`
  )
}

function markCoverFailed(book: Book) {
  failedCovers[book.id] = true
}
</script>

<template>
  <view class="page search-page">
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
    </view>

    <view class="result-head">
      <view>
        <view class="result-title">“{{ query }}”</view>
        <view class="result-meta">名称完全匹配的作品优先显示</view>
      </view>
      <text class="result-count">{{ totalResults }} 本</text>
    </view>

    <view v-if="loading" class="loading-list">
      <view v-for="index in 3" :key="index" class="skeleton card" />
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
          <view v-for="book in group.items" :key="book.id" class="book-card card">
            <view class="book-main" @tap="openCatalog(book)">
              <view class="book-row">
                <image
                  v-if="book.coverUrl && !failedCovers[book.id]"
                  class="book-cover"
                  :src="book.coverUrl"
                  mode="aspectFill"
                  lazy-load
                  @error="markCoverFailed(book)"
                />
                <view
                  v-else
                  class="book-cover cover-fallback"
                  :class="`cover-${book.source}`"
                >
                  <text class="cover-letter">{{ book.title.slice(0, 4) }}</text>
                  <text class="cover-source">{{ book.sourceLabel }}</text>
                </view>
                <view class="book-details">
                  <view class="book-title">{{ book.title }}</view>
                  <view class="book-meta">{{ book.author || '作者未知' }}</view>
                  <view v-if="book.intro" class="book-intro">{{ book.intro }}</view>
                  <button class="read-button" @tap.stop="openReader(book)">开始阅读</button>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.search-page {
  padding-top: 24rpx;
}

.search-bar {
  display: flex;
  padding: 10rpx;
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
  color: #777167;
}

.search-button {
  width: 130rpx;
  height: 76rpx;
  margin: 0;
  color: #17130a;
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

.book-card {
  padding: 22rpx;
}

.book-main {
  width: 100%;
  margin: 0;
  padding: 0;
  color: var(--ink);
  background: transparent;
  text-align: left;
  line-height: 1.45;
}

.book-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.book-cover {
  flex: 0 0 106rpx;
  width: 106rpx;
  height: 144rpx;
  overflow: hidden;
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 10rpx;
  box-shadow: 5rpx 7rpx 0 rgba(0, 0, 0, 0.3);
}

.cover-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  color: #17130a;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.42), transparent 45%),
    var(--gold);
}

.cover-kadokado {
  color: #fff4e2;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.2), transparent 45%),
    #4c3d68;
}

.cover-letter {
  display: -webkit-box;
  width: 84rpx;
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.cover-source {
  max-width: 88rpx;
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-details {
  min-width: 0;
  flex: 1;
}

.book-title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 31rpx;
  font-weight: 700;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.book-meta {
  margin-top: 9rpx;
  color: var(--gold);
  font-size: 28rpx;
}

.book-intro {
  display: -webkit-box;
  margin-top: 14rpx;
  overflow: hidden;
  color: var(--muted);
  font-size: 28rpx;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.read-button {
  width: 164rpx;
  height: 58rpx;
  margin: 16rpx 0 0;
  padding: 0;
  color: var(--ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 14rpx;
  font-size: 28rpx;
  line-height: 58rpx;
}

.skeleton {
  height: 200rpx;
  background: linear-gradient(100deg, #211f1b 20%, #2b2822 38%, #211f1b 56%);
  background-size: 200% 100%;
  animation: shimmer 1.1s infinite linear;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
