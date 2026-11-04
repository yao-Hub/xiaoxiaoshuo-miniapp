<script setup lang="ts">
import { ref } from 'vue'
import type { Book } from '@/types/novel'

const props = withDefaults(
  defineProps<{
    book: Book
    variant?: 'list' | 'grid'
  }>(),
  { variant: 'list' }
)
const emit = defineEmits<{
  open: [book: Book]
}>()

const coverFailed = ref(false)
</script>

<template>
  <view class="book-card card" :class="`book-card--${props.variant}`">
    <view class="book-main" @tap="emit('open', props.book)">
      <view class="book-row">
        <image
          v-if="props.book.coverUrl && !coverFailed"
          class="book-cover"
          :src="props.book.coverUrl"
          mode="aspectFill"
          lazy-load
          @error="coverFailed = true"
        />
        <view v-else class="book-cover cover-fallback">
          <view class="cover-placeholder-book">
            <view class="cover-placeholder-line" />
            <view class="cover-placeholder-line short" />
          </view>
          <text class="cover-placeholder-label">暂无封面</text>
        </view>
        <view class="book-details">
          <view class="book-title">{{ props.book.title }}</view>
          <view class="book-meta">{{ props.book.author || '作者未知' }}</view>
          <view v-if="props.book.intro" class="book-intro">{{ props.book.intro }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.book-card {
  padding: 22rpx;
}

.book-card--grid {
  padding: 0;
  overflow: hidden;
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
  box-shadow: 5rpx 7rpx 0 var(--shadow);
}

.cover-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: var(--button-ink);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.42), transparent 45%), var(--gold);
}

.cover-placeholder-book {
  display: flex;
  width: 46rpx;
  height: 52rpx;
  padding: 10rpx 8rpx;
  flex-direction: column;
  justify-content: center;
  gap: 7rpx;
  border: 3rpx solid currentColor;
  border-radius: 4rpx 9rpx 9rpx 4rpx;
}

.cover-placeholder-line {
  width: 100%;
  height: 3rpx;
  background: currentColor;
  opacity: 0.65;
}

.cover-placeholder-line.short {
  width: 64%;
}

.cover-placeholder-label {
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
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
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.book-card--grid .book-row {
  flex-direction: column;
  gap: 0;
}

.book-card--grid .book-cover {
  width: 100%;
  height: 320rpx;
  flex-basis: auto;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.book-card--grid .book-details {
  padding: 18rpx;
}

.book-card--grid .book-title {
  font-size: 28rpx;
  line-height: 1.45;
}

.book-card--grid .book-meta {
  margin-top: 7rpx;
  font-size: 25rpx;
}

.book-card--grid .book-intro {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.45;
}

</style>
