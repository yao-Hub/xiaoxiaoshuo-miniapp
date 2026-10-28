<script setup lang="ts">
const props = defineProps<{
  bookTitle: string
  chapterTitle: string
  topInset: number
  rightInset: number
}>()

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <view
    class="reader-top-bar"
    :style="{ paddingTop: `${props.topInset}px`, paddingRight: `${props.rightInset}px` }"
    @tap.stop
  >
    <button class="bar-icon" aria-label="返回" @tap="emit('back')">
      <view class="back-chevron" aria-hidden="true" />
    </button>
    <view class="reader-heading">
      <view class="reader-book-title">{{ props.bookTitle || '西瓜啃书' }}</view>
      <view class="reader-chapter-title">{{ props.chapterTitle }}</view>
    </view>
  </view>
</template>

<style scoped>
.reader-top-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  min-height: 96rpx;
  gap: 18rpx;
  padding-bottom: 18rpx;
  padding-left: 22rpx;
  color: var(--reader-ink);
  background: var(--toolbar-bg);
  border-bottom: 1rpx solid var(--line);
  box-shadow: 0 16rpx 44rpx var(--overlay);
}

.bar-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 16rpx;
  line-height: 1;
}

.back-chevron {
  width: 17rpx;
  height: 17rpx;
  border-bottom: 4rpx solid currentColor;
  border-left: 4rpx solid currentColor;
  transform: rotate(45deg);
}

.reader-heading {
  min-width: 0;
  flex: 1;
}

.reader-book-title,
.reader-chapter-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-book-title {
  color: var(--accent);
  font-size: 28rpx;
  font-weight: 700;
}

.reader-chapter-title {
  margin-top: 4rpx;
  color: var(--muted);
  font-size: 28rpx;
}
</style>
