<script setup lang="ts">
defineProps<{
  showOriginalProgress: boolean
  isOnPlaybackPage: boolean
  playing: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  locateOriginal: []
  fromCurrent: []
  togglePlay: []
}>()
</script>

<template>
  <view class="listen-bar" @tap.stop>
    <view v-if="loading" class="listen-bar-action loading">
      <view class="listen-bar-icon">
        <text class="loading-symbol">...</text>
      </view>
      <text class="listen-bar-label">音频正在加载</text>
    </view>

    <button v-else-if="isOnPlaybackPage" class="listen-bar-action" @tap="emit('togglePlay')">
      <view class="listen-bar-icon">
        <view v-if="playing" class="pause-symbol">
          <view class="pause-bar" />
          <view class="pause-bar" />
        </view>
        <view v-else class="play-symbol" />
      </view>
      <text class="listen-bar-label">{{ playing ? '暂停播放' : '继续播放' }}</text>
    </button>

    <template v-else>
      <button v-if="showOriginalProgress" class="listen-bar-action" @tap="emit('locateOriginal')">
        <view class="listen-bar-icon locate-icon">
          <text>⌖</text>
        </view>
        <text class="listen-bar-label">原进度</text>
      </button>
      <view v-if="showOriginalProgress" class="listen-bar-divider" />
      <button class="listen-bar-action" @tap="emit('fromCurrent')">
        <view class="listen-bar-icon">
          <view class="headphone-icon">
            <view class="headphone-band" />
            <view class="headphone-ear left" />
            <view class="headphone-ear right" />
          </view>
        </view>
        <text class="listen-bar-label">从本页听</text>
      </button>
    </template>
  </view>
</template>

<style scoped>
.listen-bar {
  display: flex;
  min-width: 240rpx;
  height: 50rpx;
  padding: 0 4rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--reader-ink);
  background: var(--toolbar-bg);
  border: 1rpx solid var(--line);
  border-radius: 999rpx;
  box-shadow:
    0 14rpx 40rpx var(--shadow),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.listen-bar-action {
  display: flex;
  height: 100%;
  margin: 0;
  padding: 0 16rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1;
}

.listen-bar-action:active {
  background: var(--accent-soft);
}

.listen-bar-action.loading {
  opacity: 0.72;
}

.listen-bar-icon {
  display: grid;
  width: 32rpx;
  height: 32rpx;
  flex: 0 0 32rpx;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 50%;
  font-size: 22rpx;
  line-height: 1;
  place-items: center;
}

.locate-icon {
  font-size: 24rpx;
}

.pause-symbol {
  display: flex;
  gap: 4rpx;
}

.pause-bar {
  width: 4rpx;
  height: 16rpx;
  background: currentColor;
  border-radius: 999rpx;
}

.play-symbol {
  width: 0;
  height: 0;
  margin-left: 2rpx;
  border-top: 8rpx solid transparent;
  border-bottom: 8rpx solid transparent;
  border-left: 12rpx solid currentColor;
}

.loading-symbol {
  font-size: 18rpx;
  letter-spacing: 1rpx;
}

.listen-bar-label {
  white-space: nowrap;
}

.listen-bar-divider {
  width: 1rpx;
  height: 36rpx;
  flex: 0 0 1rpx;
  margin: 0 4rpx;
  background: var(--line);
}

.headphone-icon {
  position: relative;
  width: 26rpx;
  height: 25rpx;
}

.headphone-band {
  position: absolute;
  top: 0;
  left: 2rpx;
  width: 22rpx;
  height: 19rpx;
  border: 2.5rpx solid currentColor;
  border-bottom: 0;
  border-radius: 16rpx 16rpx 0 0;
}

.headphone-ear {
  position: absolute;
  bottom: 1rpx;
  width: 7rpx;
  height: 14rpx;
  background: currentColor;
  border-radius: 3rpx;
}

.headphone-ear.left {
  left: 0;
}

.headphone-ear.right {
  right: 0;
}
</style>
