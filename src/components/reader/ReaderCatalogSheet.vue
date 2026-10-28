<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import type { Chapter } from '@/types/novel'

const props = defineProps<{
  bookTitle: string
  chapters: Chapter[]
  currentUrl: string
  loading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  close: []
  select: [chapter: Chapter]
  retry: []
}>()

const INITIAL_VISIBLE_COUNT = 100
const LOAD_MORE_COUNT = 100
const visibleCount = ref(INITIAL_VISIBLE_COUNT)

const currentIndex = computed(() =>
  props.chapters.findIndex((chapter) => chapter.url === props.currentUrl)
)
const visibleChapters = computed(() => props.chapters.slice(0, visibleCount.value))
const scrollTarget = computed(() =>
  currentIndex.value >= 0 ? `chapter-${currentIndex.value}` : ''
)

watch(
  () => [props.chapters.length, props.currentUrl],
  () => {
    visibleCount.value = Math.max(
      INITIAL_VISIBLE_COUNT,
      currentIndex.value >= 0 ? currentIndex.value + 40 : INITIAL_VISIBLE_COUNT
    )
  },
  { immediate: true }
)

function loadMore() {
  if (visibleCount.value < props.chapters.length) {
    visibleCount.value += LOAD_MORE_COUNT
  }
}
</script>

<template>
  <BottomSheet :z-index="60" @close="emit('close')">
    <view class="sheet-header">
      <view>
        <view class="sheet-title">章节目录</view>
        <view class="sheet-subtitle">{{ props.bookTitle }}</view>
      </view>
      <button class="sheet-close" aria-label="关闭目录" @tap="emit('close')">×</button>
    </view>

    <view v-if="props.loading" class="sheet-state">正在加载目录…</view>
    <view v-else-if="props.errorMessage" class="sheet-state">
      <view>{{ props.errorMessage }}</view>
      <button class="retry-button" @tap="emit('retry')">重新加载</button>
    </view>
    <view v-else-if="!props.chapters.length" class="sheet-state">暂无章节</view>
    <scroll-view
      v-else
      class="chapter-scroll"
      scroll-y
      :scroll-into-view="scrollTarget"
      scroll-with-animation
      @scrolltolower="loadMore"
    >
      <button
        v-for="(chapter, index) in visibleChapters"
        :id="`chapter-${index}`"
        :key="chapter.url"
        class="chapter-item"
        :class="{ active: chapter.url === props.currentUrl }"
        @tap="emit('select', chapter)"
      >
        <text class="chapter-index">{{ index + 1 }}</text>
        <text class="chapter-name">{{ chapter.title }}</text>
        <text v-if="chapter.url === props.currentUrl" class="chapter-current">当前</text>
      </button>
    </scroll-view>
  </BottomSheet>
</template>

<style scoped>
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding-bottom: 20rpx;
}

.sheet-title {
  font-size: 38rpx;
  font-weight: 800;
}

.sheet-subtitle {
  margin-top: 6rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.sheet-close {
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  color: var(--muted);
  background: var(--surface-strong);
  border-radius: 50%;
  font-size: 44rpx;
  line-height: 60rpx;
}

.chapter-scroll {
  height: 62vh;
}

.chapter-item {
  display: grid;
  width: 100%;
  min-height: 82rpx;
  margin: 0;
  padding: 14rpx 12rpx;
  grid-template-columns: 58rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 10rpx;
  color: var(--reader-ink);
  background: transparent;
  border-bottom: 1rpx solid var(--line);
  border-radius: 0;
  text-align: left;
  line-height: 1.45;
}

.chapter-item.active {
  color: var(--accent);
  background: var(--accent-soft);
}

.chapter-index {
  color: var(--muted);
  font-size: 28rpx;
  text-align: center;
}

.chapter-name {
  overflow: hidden;
  font-size: 29rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-current {
  color: var(--accent);
  font-size: 28rpx;
}

.sheet-state {
  display: flex;
  height: 46vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  color: var(--muted);
  font-size: 28rpx;
}

.retry-button {
  height: 64rpx;
  margin: 0;
  padding: 0 28rpx;
  color: var(--button-ink);
  background: var(--gold);
  border-radius: 14rpx;
  font-size: 28rpx;
  line-height: 64rpx;
}
</style>
