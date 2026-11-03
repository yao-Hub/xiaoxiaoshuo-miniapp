<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import { getCatalog } from '@/services/novel'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { usePageTheme } from '@/composables/useTheme'
import { trackAnalyticsEvent } from '@/services/analytics'
import type { Book, Chapter } from '@/types/novel'

const catalogUrl = ref('')
const initialTitle = ref('')
const initialCoverUrl = ref('')
const book = ref<Book>()
const chapters = ref<Chapter[]>([])
const loading = ref(true)
const errorMessage = ref('')
const ascending = ref(true)
const coverFailed = ref(false)
const showBackToTop = ref(false)
const { themeClass } = usePageTheme()
usePageAnalytics('catalog')

const visibleChapters = computed(() =>
  ascending.value ? chapters.value : [...chapters.value].reverse()
)

onLoad(async (options) => {
  catalogUrl.value = decodeURIComponent(String(options?.url || ''))
  initialTitle.value = decodeURIComponent(String(options?.title || ''))
  initialCoverUrl.value = decodeURIComponent(String(options?.coverUrl || ''))
  try {
    const catalog = await getCatalog(catalogUrl.value)
    book.value = {
      ...catalog.book,
      coverUrl: catalog.book.coverUrl || initialCoverUrl.value
    }
    chapters.value = catalog.chapters
    uni.setNavigationBarTitle({ title: catalog.book.title || initialTitle.value })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
})

onPageScroll(({ scrollTop }) => {
  showBackToTop.value = scrollTop > 520
})

function openChapter(chapter: Chapter) {
  trackAnalyticsEvent('reader_open', {
    page: 'catalog',
    bookTitle: book.value?.title || initialTitle.value,
    chapterUrl: chapter.url,
    metadata: { chapterTitle: chapter.title }
  })
  uni.navigateTo({
    url: `/pages/reader/reader?chapterUrl=${encodeURIComponent(chapter.url)}&catalogUrl=${encodeURIComponent(book.value?.catalogUrl || catalogUrl.value)}&bookTitle=${encodeURIComponent(book.value?.title || initialTitle.value)}&coverUrl=${encodeURIComponent(book.value?.coverUrl || initialCoverUrl.value)}`
  })
}

function backToTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  })
}
</script>

<template>
  <view class="page catalog-page" :class="themeClass">
    <view v-if="loading" class="empty">正在读取目录…</view>
    <view v-else-if="errorMessage" class="empty">{{ errorMessage }}</view>

    <template v-else-if="book">
      <view class="book-hero card">
        <image
          v-if="book.coverUrl && !coverFailed"
          class="cover"
          :src="book.coverUrl"
          mode="aspectFill"
          @error="coverFailed = true"
        />
        <view v-else class="cover generated-cover">
          <text>{{ book.title.slice(0, 1) }}</text>
        </view>
        <view class="book-info">
          <view class="book-title">{{ book.title }}</view>
          <view class="book-author">{{ book.author }} · {{ book.source }}</view>
          <view class="book-intro">{{ book.intro }}</view>
        </view>
      </view>

      <view class="catalog-head">
        <view>
          <view class="section-title">章节目录</view>
          <view class="catalog-count">共 {{ chapters.length }} 章</view>
        </view>
        <button class="sort-button" @tap="ascending = !ascending">
          {{ ascending ? '正序' : '倒序' }}
        </button>
      </view>

      <view class="catalog-list card">
        <button
          v-for="chapter in visibleChapters"
          :key="chapter.id"
          class="chapter-row"
          @tap="openChapter(chapter)"
        >
          <text class="chapter-title">{{ chapter.title }}</text>
          <text class="chapter-arrow">›</text>
        </button>
      </view>

      <button v-if="showBackToTop" class="back-to-top" aria-label="返回目录顶部" @tap="backToTop">
        <view class="back-to-top-icon" />
      </button>
    </template>

    <GlobalAudiobookPlayer />
  </view>
</template>

<style scoped>
.catalog-page {
  padding-top: 22rpx;
}

.book-hero {
  display: flex;
  gap: 26rpx;
  padding: 26rpx;
}

.cover {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 132rpx;
  width: 132rpx;
  height: 174rpx;
  color: var(--button-ink);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.34), transparent 45%), var(--gold);
  border-radius: 12rpx 20rpx 20rpx 12rpx;
  box-shadow: 8rpx 10rpx 0 var(--shadow);
  font-size: 64rpx;
  font-weight: 900;
}

.book-info {
  min-width: 0;
  flex: 1;
}

.book-title {
  font-size: 38rpx;
  font-weight: 800;
}

.book-author {
  margin-top: 10rpx;
  color: var(--gold);
  font-size: 28rpx;
}

.book-intro {
  display: -webkit-box;
  margin-top: 14rpx;
  overflow: hidden;
  color: var(--muted);
  font-size: 28rpx;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.catalog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 44rpx 4rpx 20rpx;
}

.catalog-count {
  margin-top: 8rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.sort-button {
  width: 112rpx;
  height: 58rpx;
  margin: 0;
  color: var(--ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 14rpx;
  font-size: 28rpx;
  line-height: 58rpx;
}

.catalog-list {
  overflow: hidden;
}

.chapter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  padding: 26rpx;
  color: var(--ink);
  background: transparent;
  border-bottom: 1rpx solid var(--line);
  border-radius: 0;
  text-align: left;
  line-height: 1.4;
}

.chapter-row:last-child {
  border-bottom: 0;
}

.chapter-title {
  padding-right: 20rpx;
  font-size: 30rpx;
}

.chapter-arrow {
  color: var(--muted);
  font-size: 34rpx;
}

.back-to-top {
  position: fixed;
  right: 24rpx;
  bottom: calc(32rpx + env(safe-area-inset-bottom));
  z-index: 25;
  display: grid;
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  color: var(--button-ink);
  background: var(--gold);
  border: 1rpx solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  box-shadow: 0 10rpx 28rpx var(--shadow);
  place-items: center;
}

.back-to-top-icon {
  width: 20rpx;
  height: 20rpx;
  margin-top: 8rpx;
  border-top: 4rpx solid currentColor;
  border-left: 4rpx solid currentColor;
  transform: rotate(45deg);
}
</style>
