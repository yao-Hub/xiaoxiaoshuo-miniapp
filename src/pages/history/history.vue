<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import {
  clearReadingHistory,
  clearSearchHistory,
  HISTORY_TAB_STORAGE_KEY,
  getReadingHistory,
  getSearchHistory,
  removeReadingHistory,
  removeReadingHistories,
  removeSearchHistory,
  removeSearchHistories
} from '@/utils/storage'
import type { ReadingHistoryItem } from '@/types/novel'
import { ensureUserSession, openProtectedPage } from '@/services/auth'
import { trackAnalyticsEvent } from '@/services/analytics'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useTabBarTheme } from '@/composables/useTabBarTheme'
import { syncUserDataFromServer } from '@/services/user-data-sync'

const activeTab = ref<'reading' | 'search'>('reading')
const readingHistory = ref<ReadingHistoryItem[]>([])
const searchHistory = ref<string[]>([])
const editing = ref(false)
const selectedReadingKeys = ref<string[]>([])
const selectedSearches = ref<string[]>([])
const { themeClass } = useTabBarTheme(1)
usePageAnalytics('history')
const currentItemCount = computed(() =>
  activeTab.value === 'reading' ? readingHistory.value.length : searchHistory.value.length
)
const selectedCount = computed(() =>
  activeTab.value === 'reading' ? selectedReadingKeys.value.length : selectedSearches.value.length
)
const allSelected = computed(
  () => currentItemCount.value > 0 && selectedCount.value === currentItemCount.value
)

onShow(async () => {
  try {
    await ensureUserSession()
  } catch {
    // 登录失败时仍展示本地历史。
  }
  await syncUserDataFromServer()
  const requestedTab = uni.getStorageSync(HISTORY_TAB_STORAGE_KEY)
  if (requestedTab === 'search') {
    activeTab.value = 'search'
  }
  uni.removeStorageSync(HISTORY_TAB_STORAGE_KEY)
  editing.value = false
  clearSelection()
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

function setActiveTab(tab: 'reading' | 'search') {
  activeTab.value = tab
  editing.value = false
  clearSelection()
}

function clearSelection() {
  selectedReadingKeys.value = []
  selectedSearches.value = []
}

function toggleEditing() {
  editing.value = !editing.value
  clearSelection()
}

function toggleReadingSelection(key: string) {
  selectedReadingKeys.value = selectedReadingKeys.value.includes(key)
    ? selectedReadingKeys.value.filter((item) => item !== key)
    : [...selectedReadingKeys.value, key]
}

function toggleSearchSelection(query: string) {
  selectedSearches.value = selectedSearches.value.includes(query)
    ? selectedSearches.value.filter((item) => item !== query)
    : [...selectedSearches.value, query]
}

function toggleSelectAll() {
  if (allSelected.value) {
    clearSelection()
    return
  }
  if (activeTab.value === 'reading') {
    selectedReadingKeys.value = readingHistory.value.map((item) => item.key)
  } else {
    selectedSearches.value = [...searchHistory.value]
  }
}

function deleteSelected() {
  if (!selectedCount.value) {
    return
  }
  const isReading = activeTab.value === 'reading'
  uni.showModal({
    title: '删除历史',
    content: `确定删除选中的 ${selectedCount.value} 条${isReading ? '阅读' : '搜索'}历史吗？`,
    success(result) {
      if (!result.confirm) {
        return
      }
      if (isReading) {
        removeReadingHistories(selectedReadingKeys.value)
      } else {
        removeSearchHistories(selectedSearches.value)
      }
      editing.value = false
      clearSelection()
      refresh()
    }
  })
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
      editing.value = false
      clearSelection()
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
      <view class="history-actions">
        <button v-if="currentItemCount" class="manage-button" @tap="toggleEditing">
          {{ editing ? '完成' : '管理' }}
        </button>
        <button v-if="!editing" class="clear-button" @tap="clearCurrentHistory">清空</button>
      </view>
    </view>

    <view class="tabs card">
      <button
        class="tab"
        :class="{ active: activeTab === 'reading' }"
        @tap="setActiveTab('reading')"
      >
        阅读历史
      </button>
      <button class="tab" :class="{ active: activeTab === 'search' }" @tap="setActiveTab('search')">
        搜索历史
      </button>
    </view>

    <view v-if="editing" class="edit-toolbar card">
      <button class="select-all-button" @tap="toggleSelectAll">
        {{ allSelected ? '取消全选' : '全选' }}
      </button>
      <text class="selected-count">已选择 {{ selectedCount }} 项</text>
      <button class="bulk-delete" :disabled="!selectedCount" @tap="deleteSelected">删除</button>
    </view>

    <view v-if="activeTab === 'reading'" class="history-list">
      <view v-if="!readingHistory.length" class="empty">暂无阅读历史</view>
      <view
        v-for="item in readingHistory"
        :key="item.key"
        class="history-card card"
        :class="{ selected: editing && selectedReadingKeys.includes(item.key) }"
      >
        <button
          class="history-main"
          @tap="editing ? toggleReadingSelection(item.key) : openReading(item)"
        >
          <view
            v-if="editing"
            class="selection-indicator"
            :class="{ selected: selectedReadingKeys.includes(item.key) }"
          >
            <text v-if="selectedReadingKeys.includes(item.key)">✓</text>
          </view>
          <view class="history-copy">
            <view class="history-name">{{ item.bookTitle }}</view>
            <view class="history-chapter">{{ item.chapterTitle }}</view>
            <view class="history-time">{{ formatTime(item.updatedAt) }}</view>
          </view>
        </button>
        <button v-if="!editing" class="delete-button" @tap="deleteReading(item)">删除</button>
      </view>
    </view>

    <view v-else class="history-list">
      <view v-if="!searchHistory.length" class="empty">暂无搜索历史</view>
      <view
        v-for="item in searchHistory"
        :key="item"
        class="search-history-row card"
        :class="{ selected: editing && selectedSearches.includes(item) }"
      >
        <button
          class="search-history-main"
          @tap="editing ? toggleSearchSelection(item) : openSearch(item)"
        >
          <view
            v-if="editing"
            class="selection-indicator"
            :class="{ selected: selectedSearches.includes(item) }"
          >
            <text v-if="selectedSearches.includes(item)">✓</text>
          </view>
          <text class="search-history-text">{{ item }}</text>
          <text class="search-arrow">↗</text>
        </button>
        <button v-if="!editing" class="delete-button" @tap="deleteSearch(item)">删除</button>
      </view>
    </view>

    <GlobalAudiobookPlayer placement="above-tab" />
  </view>
</template>

<style scoped>
.history-page {
  padding-top: 28rpx;
  padding-bottom: 150rpx;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 4rpx 30rpx;
}

.history-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
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
.manage-button,
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

.manage-button {
  color: var(--gold);
  border-color: rgba(245, 200, 76, 0.42);
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

.edit-toolbar {
  display: flex;
  min-height: 76rpx;
  margin-top: 20rpx;
  padding: 10rpx 14rpx;
  align-items: center;
  gap: 16rpx;
}

.select-all-button,
.bulk-delete {
  height: 56rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 13rpx;
  font-size: 28rpx;
  line-height: 56rpx;
}

.select-all-button {
  color: var(--ink);
  background: var(--surface-strong);
}

.selected-count {
  flex: 1;
  color: var(--muted);
  font-size: 27rpx;
}

.bulk-delete {
  color: var(--danger);
  background: transparent;
  border: 1rpx solid var(--danger-border);
}

.bulk-delete[disabled] {
  opacity: 0.45;
}

.history-card,
.search-history-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx;
}

.history-card.selected,
.search-history-row.selected {
  background: var(--accent-soft);
  border-color: var(--gold);
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

.history-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.history-copy {
  min-width: 0;
  flex: 1;
}

.selection-indicator {
  display: grid;
  width: 40rpx;
  height: 40rpx;
  flex: 0 0 40rpx;
  color: var(--button-ink);
  background: transparent;
  border: 2rpx solid var(--line);
  border-radius: 50%;
  font-size: 26rpx;
  font-weight: 700;
  place-items: center;
}

.selection-indicator.selected {
  background: var(--gold);
  border-color: var(--gold);
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
  gap: 16rpx;
  font-size: 30rpx;
}

.search-history-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-arrow {
  color: var(--muted);
}
</style>
