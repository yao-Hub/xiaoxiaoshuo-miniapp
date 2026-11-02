<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import {
  clearReadingHistory,
  clearSearchHistory,
  getReadingHistory,
  getSearchHistory,
  removeReadingHistory,
  removeSearchHistory
} from '@/utils/storage'
import type { ReadingHistoryItem } from '@/types/novel'
import { openProtectedPage } from '@/services/auth'
import { trackAnalyticsEvent } from '@/services/analytics'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useTabBarTheme } from '@/composables/useTabBarTheme'
import { syncUserDataFromServer } from '@/services/user-data-sync'

const activeTab = ref<'reading' | 'search'>('reading')
const readingHistory = ref<ReadingHistoryItem[]>([])
const searchHistory = ref<string[]>([])
const { themeClass } = useTabBarTheme(1)
usePageAnalytics('history')

onShow(async () => {
  await syncUserDataFromServer()
  refresh()
})

function refresh() {
  readingHistory.value = getReadingHistory()
  searchHistory.value = getSearchHistory()
}

function openReading(item: ReadingHistoryItem) {
  trackAnalyticsEvent('reader_open', {
    page: 'history',
    bookTitle: item.bookTitle,
    chapterUrl: item.chapterUrl,
    metadata: { entry: 'history' }
  })
  openProtectedPage(
    `/pages/reader/reader?chapterUrl=${encodeURIComponent(item.chapterUrl)}&catalogUrl=${encodeURIComponent(item.catalogUrl)}&bookTitle=${encodeURIComponent(item.bookTitle)}&coverUrl=${encodeURIComponent(item.coverUrl || '')}`
  )
}

function openSearch(query: string) {
  uni.navigateTo({
    url: `/pages/search/search?q=${encodeURIComponent(query)}`
  })
}

function deleteReading(item: ReadingHistoryItem) {
  uni.showModal({
    title: '删除记录',
    content: `确定删除《${item.bookTitle}》的阅读记录吗？`,
    success(result) {
      if (!result.confirm) {
        return
      }
      removeReadingHistory(item.key)
      refresh()
    }
  })
}

function deleteSearch(query: string) {
  removeSearchHistory(query)
  refresh()
}

function clearCurrentHistory() {
  const isReading = activeTab.value === 'reading'
  const items = isReading ? readingHistory.value : searchHistory.value
  if (!items.length) {
    return
  }

  uni.showModal({
    title: '清空历史',
    content: isReading ? '确定清空全部阅读历史吗？' : '确定清空全部搜索历史吗？',
    success(result) {
      if (!result.confirm) {
        return
      }
      if (isReading) {
        clearReadingHistory()
      } else {
        clearSearchHistory()
      }
      refresh()
    }
  })
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>

<template>
  <view class="page history-page" :class="themeClass">
    <view class="history-header">
      <view>
        <view class="history-title">历史</view>
        <view class="history-summary">
          {{ readingHistory.length }} 条阅读 · {{ searchHistory.length }} 条搜索
        </view>
      </view>
      <button class="clear-button" @tap="clearCurrentHistory">清空</button>
    </view>

    <view class="tabs card">
      <button class="tab" :class="{ active: activeTab === 'reading' }" @tap="activeTab = 'reading'">
        阅读历史
      </button>
      <button class="tab" :class="{ active: activeTab === 'search' }" @tap="activeTab = 'search'">
        搜索历史
      </button>
    </view>

    <view v-if="activeTab === 'reading'" class="history-list">
      <view v-if="!readingHistory.length" class="empty">暂无阅读历史</view>
      <view v-for="item in readingHistory" :key="item.key" class="history-card card">
        <button class="history-main" @tap="openReading(item)">
          <view class="history-name">{{ item.bookTitle }}</view>
          <view class="history-chapter">{{ item.chapterTitle }}</view>
          <view class="history-time">{{ formatTime(item.updatedAt) }}</view>
        </button>
        <button class="delete-button" @tap="deleteReading(item)">删除</button>
      </view>
    </view>

    <view v-else class="history-list">
      <view v-if="!searchHistory.length" class="empty">暂无搜索历史</view>
      <view v-for="item in searchHistory" :key="item" class="search-history-row card">
        <button class="search-history-main" @tap="openSearch(item)">
          <text>{{ item }}</text>
          <text class="search-arrow">↗</text>
        </button>
        <button class="delete-button" @tap="deleteSearch(item)">删除</button>
      </view>
    </view>

    <GlobalAudiobookPlayer placement="above-tab" />
  </view>
</template>

<style scoped>
.history-page {
  padding-top: 28rpx;
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 4rpx 30rpx;
}

.history-title {
  font-size: 52rpx;
  font-weight: 800;
}

.history-summary {
  margin-top: 8rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.clear-button,
.delete-button {
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  color: var(--danger);
  background: transparent;
  border: 1rpx solid var(--danger-border);
  border-radius: 13rpx;
  font-size: 28rpx;
  line-height: 56rpx;
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 8rpx;
}

.tab {
  height: 64rpx;
  margin: 0;
  color: var(--muted);
  background: transparent;
  border-radius: 14rpx;
  font-size: 30rpx;
  line-height: 64rpx;
}

.tab.active {
  color: var(--button-ink);
  background: var(--gold);
  font-weight: 700;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.history-card,
.search-history-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx;
}

.history-main,
.search-history-main {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 8rpx 10rpx;
  color: var(--ink);
  background: transparent;
  text-align: left;
  line-height: 1.45;
}

.history-name {
  font-size: 29rpx;
  font-weight: 700;
}

.history-chapter {
  margin-top: 8rpx;
  color: var(--gold);
  font-size: 28rpx;
}

.history-time {
  margin-top: 8rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.search-history-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 30rpx;
}

.search-arrow {
  color: var(--muted);
}
</style>
