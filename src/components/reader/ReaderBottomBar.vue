<script setup lang="ts">
import { computed } from 'vue'
import { READER_SLIDER_COLORS } from '@/constants/reader'
import type { ResolvedTheme } from '@/types/theme'

const props = defineProps<{
  sliderValue: number
  sliderMax: number
  sliderDisabled: boolean
  sliderPlaceholder: string
  previewing: boolean
  previewTitle: string
  previewProgress: number
  theme: ResolvedTheme
  previousDisabled: boolean
  nextDisabled: boolean
}>()

const emit = defineEmits<{
  previous: []
  next: []
  catalog: []
  settings: []
  toggleTheme: []
  preview: [index: number]
  seek: [index: number]
}>()

const activeColor = computed(() => READER_SLIDER_COLORS[props.theme].active)
const trackColor = computed(() => READER_SLIDER_COLORS[props.theme].track)
const tooltipLeft = computed(() => `${Math.min(84, Math.max(16, props.previewProgress))}%`)

function handleSliderChange(event: { detail: { value: number } }) {
  emit('seek', event.detail.value)
}
</script>

<template>
  <view class="reader-bottom-bar" @tap.stop>
    <view class="chapter-progress-row">
      <button
        class="chapter-arrow"
        :disabled="props.previousDisabled"
        aria-label="上一章"
        @tap="emit('previous')"
      >
        ‹ 上一章
      </button>

      <view class="slider-shell">
        <view v-if="props.previewing" class="chapter-preview" :style="{ left: tooltipLeft }">
          <view class="chapter-preview-percent">{{ props.previewProgress }}%</view>
          <view class="chapter-preview-title">{{ props.previewTitle }}</view>
        </view>
        <view v-if="props.sliderDisabled" class="slider-placeholder">
          {{ props.sliderPlaceholder }}
        </view>
        <slider
          v-else
          class="chapter-slider"
          :value="props.sliderValue"
          :min="0"
          :max="Math.max(0, props.sliderMax)"
          :step="1"
          :active-color="activeColor"
          :background-color="trackColor"
          :block-color="activeColor"
          :block-size="22"
          @changing="emit('preview', $event.detail.value)"
          @change="handleSliderChange"
        />
      </view>

      <button
        class="chapter-arrow next"
        :disabled="props.nextDisabled"
        aria-label="下一章"
        @tap="emit('next')"
      >
        下一章 ›
      </button>
    </view>

    <view class="bottom-actions">
      <button class="bottom-action" @tap="emit('catalog')">
        <text class="action-symbol">☷</text>
        <text>目录</text>
      </button>
      <button class="bottom-action" @tap="emit('settings')">
        <text class="action-symbol text-symbol">Aa</text>
        <text>设置</text>
      </button>
      <button class="bottom-action" @tap="emit('toggleTheme')">
        <text class="action-symbol">{{ props.theme === 'dark' ? '☀' : '☾' }}</text>
        <text>{{ props.theme === 'dark' ? '日间' : '夜间' }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.reader-bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  padding: 20rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  color: var(--reader-ink);
  background: var(--toolbar-bg);
  border-top: 1rpx solid var(--line);
  box-shadow: 0 -16rpx 44rpx var(--overlay);
}

.chapter-progress-row {
  display: grid;
  grid-template-columns: 138rpx minmax(0, 1fr) 138rpx;
  align-items: center;
  gap: 12rpx;
  min-height: 58rpx;
}

.chapter-arrow {
  display: flex;
  height: 58rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  color: var(--reader-ink);
  background: transparent;
  font-size: 28rpx;
  line-height: 58rpx;
}

.chapter-arrow.next {
  justify-content: flex-end;
  text-align: right;
}

.chapter-arrow[disabled] {
  color: var(--muted);
  opacity: 0.42;
}

.slider-shell {
  position: relative;
  min-width: 0;
}

.chapter-slider {
  margin: 0;
}

.slider-placeholder {
  display: flex;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 28rpx;
}

.chapter-preview {
  position: absolute;
  top: -74rpx;
  width: 300rpx;
  padding: 14rpx 18rpx;
  color: #fff7e8;
  background: rgba(58, 52, 40, 0.94);
  border-radius: 18rpx;
  box-shadow: 0 12rpx 34rpx rgba(0, 0, 0, 0.24);
  text-align: center;
  transform: translateX(-50%);
}

.chapter-preview-percent {
  font-size: 28rpx;
  font-weight: 700;
}

.chapter-preview-title {
  margin-top: 4rpx;
  overflow: hidden;
  font-size: 28rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24rpx;
  margin-top: 20rpx;
}

.bottom-action {
  display: flex;
  height: 82rpx;
  margin: 0;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 18rpx;
  font-size: 29rpx;
  line-height: 82rpx;
}

.action-symbol {
  color: var(--accent);
  font-size: 34rpx;
}

.text-symbol {
  font-size: 29rpx;
  font-weight: 800;
}
</style>
