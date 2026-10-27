<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getChapter } from '@/services/novel'
import { rememberReading } from '@/utils/storage'
import type { ChapterContent } from '@/types/novel'

const chapterUrl = ref('')
const catalogUrl = ref('')
const bookTitle = ref('')
const chapter = ref<ChapterContent>()
const loading = ref(true)
const errorMessage = ref('')
const fontSize = ref(Number(uni.getStorageSync('xiaoxiaoshuo.readerFontSize') || 34))

const paragraphs = computed(() =>
  String(chapter.value?.content || '')
    .split(/\n{2,}/)
    .filter(Boolean)
)

onLoad(async (options) => {
  chapterUrl.value = decodeURIComponent(String(options?.chapterUrl || ''))
  catalogUrl.value = decodeURIComponent(String(options?.catalogUrl || ''))
  bookTitle.value = decodeURIComponent(String(options?.bookTitle || ''))
  await loadChapter(chapterUrl.value)
})

async function loadChapter(targetUrl: string) {
  if (!targetUrl) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const nextChapter = await getChapter(targetUrl)
    chapter.value = nextChapter
    chapterUrl.value = nextChapter.chapterUrl
    catalogUrl.value = nextChapter.catalogUrl || catalogUrl.value
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
    rememberReading({
      key: nextChapter.catalogUrl || nextChapter.chapterUrl,
      bookTitle: bookTitle.value || '未命名作品',
      chapterTitle: nextChapter.title,
      chapterUrl: nextChapter.chapterUrl,
      catalogUrl: nextChapter.catalogUrl,
      updatedAt: Date.now()
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

function openCatalog() {
  if (!catalogUrl.value) {
    uni.showToast({ title: '当前章节没有目录地址', icon: 'none' })
    return
  }

  uni.navigateTo({
    url: `/pages/catalog/catalog?url=${encodeURIComponent(catalogUrl.value)}&title=${encodeURIComponent(bookTitle.value)}`
  })
}

function goBack() {
  uni.navigateBack()
}

function changeFont(delta: number) {
  const next = Math.max(28, Math.min(44, fontSize.value + delta))
  fontSize.value = next
  uni.setStorageSync('xiaoxiaoshuo.readerFontSize', next)
}
</script>

<template>
  <view class="reader-page">
    <view class="reader-toolbar">
      <button class="toolbar-button" @tap="goBack">返回</button>
      <button class="toolbar-button" @tap="openCatalog">目录</button>
      <view class="font-controls">
        <button class="font-button" @tap="changeFont(-2)">A-</button>
        <button class="font-button" @tap="changeFont(2)">A+</button>
      </view>
    </view>

    <view v-if="loading" class="empty">正在加载正文…</view>
    <view v-else-if="errorMessage" class="empty">{{ errorMessage }}</view>

    <view v-else-if="chapter" class="reader-content" :style="{ fontSize: `${fontSize}rpx` }">
      <view class="book-name">{{ bookTitle }}</view>
      <view class="chapter-name">{{ chapter.title }}</view>
      <view class="divider" />
      <view class="paragraph" v-for="(paragraph, index) in paragraphs" :key="index">
        {{ paragraph }}
      </view>

      <view class="chapter-navigation">
        <button
          class="nav-button"
          :disabled="!chapter.prevUrl"
          @tap="loadChapter(chapter.prevUrl)"
        >
          上一章
        </button>
        <button class="nav-button catalog-button" @tap="openCatalog">目录</button>
        <button
          class="nav-button"
          :disabled="!chapter.nextUrl"
          @tap="loadChapter(chapter.nextUrl)"
        >
          下一章
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.reader-page {
  min-height: 100vh;
  padding: 24rpx 28rpx calc(56rpx + env(safe-area-inset-bottom));
  background: #171614;
}

.reader-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 0 22rpx;
  background: linear-gradient(#171614 76%, transparent);
}

.toolbar-button,
.font-button {
  height: 58rpx;
  margin: 0;
  padding: 0 20rpx;
  color: var(--ink);
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 13rpx;
  font-size: 28rpx;
  line-height: 58rpx;
}

.font-controls {
  display: flex;
  gap: 8rpx;
  margin-left: auto;
}

.font-button {
  width: 70rpx;
  padding: 0;
}

.reader-content {
  max-width: 760rpx;
  margin: 0 auto;
  padding: 30rpx 8rpx;
  line-height: 1.95;
}

.book-name {
  color: var(--gold);
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.chapter-name {
  margin-top: 18rpx;
  font-size: 46rpx;
  font-weight: 800;
  line-height: 1.4;
}

.divider {
  width: 92rpx;
  height: 5rpx;
  margin: 30rpx 0 38rpx;
  background: var(--gold);
  border-radius: 999rpx;
}

.paragraph {
  margin-bottom: 30rpx;
  text-indent: 2em;
  letter-spacing: 1rpx;
}

.chapter-navigation {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14rpx;
  margin-top: 58rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid var(--line);
}

.nav-button {
  height: 70rpx;
  margin: 0;
  padding: 0;
  color: var(--ink);
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 15rpx;
  font-size: 28rpx;
  line-height: 70rpx;
}

.nav-button[disabled] {
  color: #615c53;
}

.catalog-button {
  color: #17130a;
  background: var(--gold);
  font-weight: 700;
}
</style>
