<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import type { Chapter } from '@/types/novel'

const props = defineProps<{
  bookTitle: string
  chapters: Chapter[]
  currentUrl: string
  loading: boolean
  errorMessage: string
  autoLocate: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [chapter: Chapter]
  retry: []
}>()

const INITIAL_VISIBLE_COUNT = 100
const LOAD_MORE_COUNT = 100
const visibleCount = ref(INITIAL_VISIBLE_COUNT)
const ascending = ref(true)
const scrollTarget = ref('')
let initialLocateDone = false

const currentIndex = computed(() =>
  props.chapters.findIndex((chapter) => chapter.url === props.currentUrl)
)
const orderedChapters = computed(() => {
  const items = props.chapters.map((chapter, index) => ({
    chapter,
    chapterNumber: index + 1
  }))
  return ascending.value ? items : items.reverse()
})
const visibleChapters = computed(() => orderedChapters.value.slice(0, visibleCount.value))
const currentDisplayIndex = computed(() =>
  visibleChapters.value.findIndex((item) => item.chapter.url === props.currentUrl)
)
watch(
  () => [props.chapters.length, props.currentUrl, ascending.value],
  () => {
    const currentDisplayPosition = ascending.value
      ? currentIndex.value
      : props.chapters.length - 1 - currentIndex.value
    visibleCount.value = Math.max(
      INITIAL_VISIBLE_COUNT,
      currentDisplayPosition >= 0 ? currentDisplayPosition + 40 : INITIAL_VISIBLE_COUNT
    )
  },
  { immediate: true }
)

watch(
  () => [props.chapters.length, currentIndex.value] as const,
  () => {
    if (!props.autoLocate || initialLocateDone || currentIndex.value < 0) {
      return
    }
    initialLocateDone = true
    void nextTick().then(locateCurrentChapter)
  },
  { immediate: true, flush: 'post' }
)

function loadMore() {
  if (visibleCount.value < props.chapters.length) {
    visibleCount.value += LOAD_MORE_COUNT
  }
}

async function locateCurrentChapter() {
  if (currentDisplayIndex.value < 0) {
    visibleCount.value = Math.max(visibleCount.value, currentIndex.value + 40)
    await nextTick()
  }
  scrollTarget.value = ''
  await nextTick()
  if (currentDisplayIndex.value >= 0) {
    scrollTarget.value = `chapter-${currentDisplayIndex.value}`
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
      <view class="sheet-actions">
        <button class="sheet-locate-button" @tap="locateCurrentChapter">
          <view class="locate-icon">
            <view class="locate-center" />
            <view class="locate-tick top" />
            <view class="locate-tick right" />
            <view class="locate-tick bottom" />
            <view class="locate-tick left" />
          </view>
        </button>
        <button class="sheet-sort-button" @tap="ascending = !ascending">
          {{ ascending ? '正序' : '倒序' }}
        </button>
        <button class="sheet-icon-button close-button" @tap="emit('close')">×</button>
      </view>
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
        v-for="(item, index) in visibleChapters"
        :id="`chapter-${index}`"
        :key="item.chapter.url"
        class="chapter-item"
        :class="{ active: item.chapter.url === props.currentUrl }"
        @tap="emit('select', item.chapter)"
      >
        <text class="chapter-index">{{ item.chapterNumber }}</text>
        <text class="chapter-name">{{ item.chapter.title }}</text>
        <text v-if="item.chapter.url === props.currentUrl" class="chapter-current">当前</text>
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

.sheet-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12rpx;
}

.sheet-icon-button {
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  color: var(--muted);
  background: var(--surface-strong);
  border-radius: 50%;
  line-height: 60rpx;
}

.sheet-locate-button {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: var(--surface-strong);
  border-radius: 50%;
}

.locate-icon {
  position: relative;
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid currentColor;
  border-radius: 50%;
}

.locate-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7rpx;
  height: 7rpx;
  background: currentColor;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.locate-tick {
  position: absolute;
  width: 3rpx;
  height: 8rpx;
  background: currentColor;
}

.locate-tick.top {
  top: -8rpx;
  left: 50%;
  transform: translateX(-50%);
}

.locate-tick.right {
  top: 50%;
  right: -8rpx;
  transform: translateY(-50%) rotate(90deg);
}

.locate-tick.bottom {
  bottom: -8rpx;
  left: 50%;
  transform: translateX(-50%);
}

.locate-tick.left {
  top: 50%;
  left: -8rpx;
  transform: translateY(-50%) rotate(90deg);
}

.sheet-sort-button {
  width: 112rpx;
  height: 58rpx;
  margin: 0;
  padding: 0;
  color: var(--ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 14rpx;
  font-size: 28rpx;
  line-height: 58rpx;
}

.close-button {
  font-size: 44rpx;
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
