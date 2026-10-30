<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import { getReadingHistory, getSearchHistory, removeSearchHistory } from '@/utils/storage'
import { getAuthToken, openLoginPage, openProtectedPage } from '@/services/auth'
import {
  getRecommendationCategories,
  type RecommendationCategories
} from '@/services/recommendations'
import { trackAnalyticsEvent } from '@/services/analytics'
import type { ReadingHistoryItem } from '@/types/novel'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useTabBarTheme } from '@/composables/useTabBarTheme'

const query = ref('')
const searchHistory = ref<string[]>([])
const readingHistory = ref<ReadingHistoryItem[]>([])
const recommendations = ref<RecommendationCategories>({ searches: [], books: [] })

const defaultSuggestions = ['完美世界', '盘龙', '斗破苍穹', '遮天']
const suggestions = computed(() =>
  [...recommendations.value.books, ...recommendations.value.searches, ...defaultSuggestions]
    .filter((item, index, items) => item && items.indexOf(item) === index)
    .slice(0, 8)
)
const { themeClass } = useTabBarTheme(0)
usePageAnalytics('index')

onShow(() => {
  searchHistory.value = getSearchHistory().slice(0, 6)
  readingHistory.value = getReadingHistory().slice(0, 1)
  if (getAuthToken()) {
    void loadRecommendations()
  } else {
    recommendations.value = { searches: [], books: [] }
  }
})

async function loadRecommendations() {
  try {
    recommendations.value = await getRecommendationCategories()
  } catch {
    recommendations.value = { searches: [], books: [] }
  }
}

function openSearch(value = query.value) {
  const next = value.trim()
  if (!next) {
    uni.showToast({ title: '请输入书名', icon: 'none' })
    return
  }
  if (!getAuthToken()) {
    const target = `/pages/search/search?q=${encodeURIComponent(next)}`
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
    return
  }
  uni.navigateTo({
    url: `/pages/search/search?q=${encodeURIComponent(next)}`
  })
}

function continueReading(item: ReadingHistoryItem) {
  trackAnalyticsEvent('reader_open', {
    page: 'index',
    bookTitle: item.bookTitle,
    chapterUrl: item.chapterUrl,
    metadata: { entry: 'continue_reading' }
  })
  openProtectedPage(
    `/pages/reader/reader?chapterUrl=${encodeURIComponent(item.chapterUrl)}&catalogUrl=${encodeURIComponent(item.catalogUrl)}&bookTitle=${encodeURIComponent(item.bookTitle)}&coverUrl=${encodeURIComponent(item.coverUrl || '')}`
  )
}

function openHistory() {
  uni.switchTab({ url: '/pages/history/history' })
}

function deleteRecentSearch(query: string) {
  removeSearchHistory(query)
  searchHistory.value = getSearchHistory().slice(0, 6)
}
</script>

<template>
  <view class="page home-page" :class="themeClass">
    <view class="hero">
      <view class="eyebrow">CROSS-SITE READING</view>
      <view class="brand">西瓜啃书</view>
      <view class="slogan">输入书名，穿过站点边界，找到想读的故事。</view>
    </view>

    <view class="search-card card">
      <input
        v-model="query"
        class="search-input"
        placeholder="输入书名或地址"
        placeholder-class="search-placeholder"
        confirm-type="search"
        @confirm="openSearch()"
      />
      <button class="search-button" @tap="openSearch()">搜索</button>
    </view>

    <view v-if="readingHistory.length" class="section">
      <view class="section-head">
        <text class="section-title">继续阅读</text>
      </view>
      <button class="continue-card card" @tap="continueReading(readingHistory[0])">
        <view>
          <view class="continue-title">{{ readingHistory[0].bookTitle }}</view>
          <view class="continue-chapter">{{ readingHistory[0].chapterTitle }}</view>
        </view>
        <text class="continue-arrow">继续 →</text>
      </button>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">快速发现</text>
        <text class="muted">根据近期热度推荐</text>
      </view>
      <view class="chips">
        <button v-for="item in suggestions" :key="item" class="chip" @tap="openSearch(item)">
          {{ item }}
        </button>
      </view>
    </view>

    <view v-if="searchHistory.length" class="section">
      <view class="section-head">
        <text class="section-title">最近搜索</text>
        <text class="history-link" @tap="openHistory">查看全部</text>
      </view>
      <view class="chips">
        <view v-for="item in searchHistory" :key="item" class="recent-chip">
          <button class="recent-chip-main" @tap="openSearch(item)">{{ item }}</button>
          <button
            class="recent-chip-delete"
            aria-label="删除这条搜索历史"
            @tap.stop="deleteRecentSearch(item)"
          >
            ×
          </button>
        </view>
      </view>
    </view>

    <GlobalAudiobookPlayer placement="above-tab" />
  </view>
</template>

<style scoped>
.home-page {
  padding-top: 54rpx;
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.hero {
  padding: 16rpx 8rpx 48rpx;
}

.eyebrow {
  color: var(--gold);
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 5rpx;
}

.brand {
  margin-top: 18rpx;
  font-size: 78rpx;
  font-weight: 900;
  letter-spacing: 5rpx;
  line-height: 1.1;
}

.slogan {
  max-width: 600rpx;
  margin-top: 20rpx;
  color: var(--muted);
  font-size: 30rpx;
  line-height: 1.7;
}

.search-card {
  display: flex;
  padding: 12rpx;
  box-shadow: 0 24rpx 70rpx var(--shadow);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 82rpx;
  padding: 0 22rpx;
  color: var(--ink);
  font-size: 30rpx;
}

.search-placeholder {
  color: var(--muted);
}

.search-button {
  width: 142rpx;
  height: 82rpx;
  margin: 0;
  color: var(--button-ink);
  background: var(--gold);
  border-radius: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 82rpx;
}

.section {
  margin-top: 46rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.continue-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  padding: 26rpx;
  color: var(--ink);
  text-align: left;
  line-height: 1.4;
}

.continue-title {
  font-size: 34rpx;
  font-weight: 700;
}

.continue-chapter {
  margin-top: 9rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.continue-arrow {
  color: var(--gold);
  font-size: 28rpx;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  margin: 0;
  padding: 0 24rpx;
  color: var(--ink);
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 999rpx;
  font-size: 30rpx;
  line-height: 64rpx;
}

.history-link {
  color: var(--gold);
  font-size: 28rpx;
}

.recent-chip {
  display: flex;
  align-items: center;
  overflow: hidden;
  color: var(--ink);
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 999rpx;
}

.recent-chip-main {
  height: 64rpx;
  margin: 0;
  padding: 0 12rpx 0 24rpx;
  color: var(--ink);
  background: transparent;
  font-size: 30rpx;
  line-height: 64rpx;
}

.recent-chip-delete {
  width: 58rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  color: var(--muted);
  background: transparent;
  border-left: 1rpx solid var(--line);
  font-size: 32rpx;
  line-height: 64rpx;
}

.recent-chip-delete:active {
  color: var(--danger);
}
</style>
