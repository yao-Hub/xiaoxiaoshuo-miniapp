<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    zIndex?: number
    showHandle?: boolean
  }>(),
  {
    zIndex: 60,
    showHandle: true
  }
)

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <view class="bottom-sheet-overlay" :style="{ zIndex: props.zIndex }" @tap="emit('close')">
    <view class="bottom-sheet-panel" @tap.stop>
      <view v-if="props.showHandle" class="bottom-sheet-handle" />
      <slot />
    </view>
  </view>
</template>

<style scoped>
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.48);
}

.bottom-sheet-panel {
  width: 100%;
  padding: 12rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
  color: var(--reader-ink);
  background: var(--bottom-sheet-bg, var(--toolbar-bg));
  border-radius: 30rpx 30rpx 0 0;
  box-shadow: 0 -24rpx 70rpx rgba(0, 0, 0, 0.3);
  animation: bottom-sheet-in 180ms ease-out;
}

.bottom-sheet-handle {
  width: 76rpx;
  height: 8rpx;
  margin: 0 auto 20rpx;
  background: var(--line);
  border-radius: 999rpx;
}

@keyframes bottom-sheet-in {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}
</style>
