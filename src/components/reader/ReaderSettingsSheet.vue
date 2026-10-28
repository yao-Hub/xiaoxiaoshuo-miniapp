<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import {
  READER_BRIGHTNESS_MIN,
  READER_FONT_SIZE_MAX,
  READER_FONT_SIZE_MIN,
  READER_PAGE_MODES,
  READER_SLIDER_COLORS
} from '@/constants/reader'
import type { ReaderPageMode } from '@/types/reader'
import type { ResolvedTheme } from '@/types/theme'

const props = defineProps<{
  fontSize: number
  brightness: number
  pageMode: ReaderPageMode
  theme: ResolvedTheme
}>()

const emit = defineEmits<{
  close: []
  fontSizeChange: [value: number]
  brightnessChange: [value: number]
  pageModeChange: [value: ReaderPageMode]
  reset: []
}>()

const activeColor = computed(() => READER_SLIDER_COLORS[props.theme].active)
const trackColor = computed(() => READER_SLIDER_COLORS[props.theme].track)
const fontSizeInput = ref(String(props.fontSize))

watch(
  () => props.fontSize,
  (value) => {
    fontSizeInput.value = String(value)
  }
)

function changeFontSize(delta: number) {
  applyFontSize(props.fontSize + delta)
}

function handleFontInput(event: Event) {
  const detail = (event as Event & { detail?: { value?: string } }).detail
  const value = detail?.value || (event.target as HTMLInputElement | null)?.value || ''
  fontSizeInput.value = value.replace(/[^\d]/g, '').slice(0, 2)
}

function commitFontSize() {
  const value = Number(fontSizeInput.value)
  applyFontSize(Number.isFinite(value) ? value : props.fontSize)
}

function applyFontSize(value: number) {
  const next = Math.min(READER_FONT_SIZE_MAX, Math.max(READER_FONT_SIZE_MIN, value))
  fontSizeInput.value = String(next)
  emit('fontSizeChange', next)
}

function changeBrightness(event: { detail: { value: number } }) {
  emit('brightnessChange', event.detail.value)
}
</script>

<template>
  <BottomSheet :z-index="70" @close="emit('close')">
    <view class="setting-row">
      <view class="setting-heading">
        <text class="setting-label">亮度</text>
        <text class="setting-value">{{ props.brightness }}%</text>
      </view>
      <slider
        class="setting-slider"
        :value="props.brightness"
        :min="READER_BRIGHTNESS_MIN"
        :max="100"
        :step="1"
        :active-color="activeColor"
        :background-color="trackColor"
        :block-color="activeColor"
        :block-size="22"
        @changing="changeBrightness"
        @change="changeBrightness"
      />
    </view>

    <view class="setting-section">
      <view class="setting-heading">
        <text class="setting-label">文字大小</text>
        <text class="setting-value">{{ props.fontSize }}</text>
      </view>
      <view class="font-controls">
        <button
          class="font-button"
          :disabled="props.fontSize <= READER_FONT_SIZE_MIN"
          aria-label="减小文字"
          @tap="changeFontSize(-1)"
        >
          A−
        </button>
        <input
          class="font-size-input"
          type="number"
          :value="fontSizeInput"
          maxlength="2"
          confirm-type="done"
          aria-label="自定义文字大小"
          @input="handleFontInput"
          @blur="commitFontSize"
          @confirm="commitFontSize"
        />
        <button
          class="font-button"
          :disabled="props.fontSize >= READER_FONT_SIZE_MAX"
          aria-label="增大文字"
          @tap="changeFontSize(1)"
        >
          A+
        </button>
      </view>
    </view>

    <view class="setting-section">
      <view class="setting-label">翻页模式</view>
      <view class="mode-options">
        <button
          v-for="option in READER_PAGE_MODES"
          :key="option.value"
          class="mode-option"
          :class="{ active: props.pageMode === option.value }"
          @tap="emit('pageModeChange', option.value)"
        >
          <text class="mode-label">{{ option.label }}</text>
        </button>
      </view>
    </view>

    <button class="reset-button" @tap="emit('reset')">恢复默认设置</button>
  </BottomSheet>
</template>

<style scoped>
.setting-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.setting-row,
.setting-section {
  padding: 20rpx 0;
  border-top: 1rpx solid var(--line);
}

.setting-label {
  font-size: 30rpx;
  font-weight: 700;
}

.setting-value {
  color: var(--accent);
  font-size: 28rpx;
}

.setting-slider {
  margin: 18rpx 0 0;
}

.font-controls {
  display: grid;
  grid-template-columns: 120rpx 1fr 120rpx;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
}

.font-button {
  height: 72rpx;
  margin: 0;
  padding: 0;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 18rpx;
  font-size: 32rpx;
  line-height: 72rpx;
}

.font-button[disabled] {
  color: var(--muted);
  opacity: 0.45;
}

.font-size-input {
  width: 100%;
  height: 72rpx;
  padding: 0 12rpx;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}

.mode-option {
  display: flex;
  min-height: 72rpx;
  margin: 0;
  padding: 16rpx;
  flex-direction: column;
  justify-content: center;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid var(--line);
  border-radius: 18rpx;
  text-align: left;
  line-height: 1.4;
}

.mode-option.active {
  color: var(--button-ink);
  background: var(--gold);
  border-color: var(--gold);
}

.mode-label {
  font-size: 29rpx;
  font-weight: 700;
}

.reset-button {
  width: 100%;
  height: 72rpx;
  margin: 8rpx 0 0;
  color: var(--muted);
  background: transparent;
  border: 1rpx solid var(--line);
  border-radius: 18rpx;
  font-size: 28rpx;
  line-height: 72rpx;
}
</style>
