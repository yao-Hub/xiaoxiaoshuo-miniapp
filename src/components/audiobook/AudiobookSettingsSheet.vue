<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { useTheme } from '@/composables/useTheme'
import type { AudiobookSleepTimerState } from '@/composables/useAudiobookSleepTimer'

const props = defineProps<{
  sleepTimer: AudiobookSleepTimerState
  playbackRate: number
  rateOnlyForBook: boolean
}>()

const emit = defineEmits<{
  close: []
  setTimerMinutes: [minutes: number]
  setTimerChapters: [chapters: 1 | 3 | 5]
  cancelTimer: []
  setPlaybackRate: [rate: number]
  setRateOnlyForBook: [enabled: boolean]
  resetPlaybackRate: []
}>()

const { resolvedTheme } = useTheme()

type SettingsView = 'settings' | 'timer' | 'rate' | 'custom'

const CHAPTER_TIMERS: ReadonlyArray<{ label: string; count: 1 | 3 | 5 }> = [
  { label: '播完本章', count: 1 },
  { label: '播完3章', count: 3 },
  { label: '播完5章', count: 5 }
]
const MINUTE_TIMERS = ['10分钟', '30分钟', '60分钟', '90分钟']
const RATE_MARKS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)

const view = ref<SettingsView>('settings')
const pickerValue = ref([0, 1])

const pickerIndicatorStyle = computed(() =>
  resolvedTheme.value === 'dark'
    ? 'height: 96rpx; border-top: 1rpx solid #555555; border-bottom: 1rpx solid #555555;'
    : 'height: 96rpx; border-top: 1rpx solid var(--line); border-bottom: 1rpx solid var(--line);'
)
const playbackRateLabel = computed(() => props.playbackRate.toFixed(1))
const playbackRateSliderValue = computed(() => Math.round(props.playbackRate * 10))
const playbackRateActiveColor = computed(() =>
  resolvedTheme.value === 'dark' ? '#f5c84c' : '#8c5b00'
)
const playbackRateTrackColor = computed(() =>
  resolvedTheme.value === 'dark' ? 'rgba(245, 237, 220, 0.14)' : 'rgba(61, 48, 31, 0.14)'
)
const timerEnabled = computed(() => props.sleepTimer.mode !== 'off')
const customTimerSelected = computed(
  () =>
    props.sleepTimer.mode === 'time' &&
    !MINUTE_TIMERS.some(
      (label) => Number(label.replace('分钟', '')) * 60 === props.sleepTimer.durationSeconds
    )
)
const timerLabel = computed(() => {
  if (props.sleepTimer.mode === 'chapters') {
    if (props.sleepTimer.totalChapters === 1) {
      return '播完本章'
    }
    return `播完${props.sleepTimer.totalChapters}章`
  }
  if (props.sleepTimer.mode === 'time') {
    const preset = MINUTE_TIMERS.find(
      (item) => Number(item.replace('分钟', '')) * 60 === props.sleepTimer.durationSeconds
    )
    return preset || formatDuration(props.sleepTimer.durationSeconds)
  }
  return '未开启'
})
const remainingTimerLabel = computed(() => {
  if (props.sleepTimer.mode === 'chapters') {
    return `剩余播放${props.sleepTimer.remainingChapters}章`
  }
  return `剩余 ${formatRemainingTime(props.sleepTimer.remainingSeconds)}`
})

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  const two = (value: number) => String(value).padStart(2, '0')
  return `${two(minutes)}:${two(remaining)}`
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}小时${minutes}分钟`
}

function close() {
  emit('close')
}

function changePicker(event: { detail: { value: number[] } }) {
  const next = event.detail.value
  pickerValue.value = [
    Math.max(0, Math.min(HOURS.length - 1, Number(next[0]) || 0)),
    Math.max(0, Math.min(MINUTES.length - 1, Number(next[1]) || 0))
  ]
}

function selectChapterTimer(chapters: 1 | 3 | 5) {
  emit('setTimerChapters', chapters)
}

function selectMinuteTimer(minutes: number) {
  emit('setTimerMinutes', minutes)
}

function confirmCustomTime() {
  const hours = HOURS[pickerValue.value[0]]
  const minutes = MINUTES[pickerValue.value[1]]
  const totalMinutes = hours * 60 + minutes
  if (totalMinutes <= 0) {
    uni.showToast({ title: '请选择至少1分钟', icon: 'none' })
    return
  }
  emit('setTimerMinutes', totalMinutes)
  view.value = 'timer'
}

function changeTimer(event: Event) {
  const detail = (event as Event & { detail: { value: boolean } }).detail
  if (!detail.value) {
    emit('cancelTimer')
  }
}

function changePlaybackRate(event: Event) {
  const detail = (event as Event & { detail: { value: number } }).detail
  emit('setPlaybackRate', Number(detail.value) / 10)
}

function changeRateOnlyForBook(event: Event) {
  const detail = (event as Event & { detail: { value: boolean } }).detail
  emit('setRateOnlyForBook', detail.value)
}
</script>

<template>
  <BottomSheet
    :z-index="80"
    :show-handle="false"
    :class="{
      'custom-duration-sheet': view === 'custom',
      'custom-duration-sheet--dark': view === 'custom' && resolvedTheme === 'dark'
    }"
    @close="close"
  >
    <template v-if="view === 'settings'">
      <view class="sheet-heading">
        <button class="sheet-back" aria-label="关闭听书设置" @tap="close">⌄</button>
        <text class="sheet-title">听书设置</text>
        <view class="sheet-heading-spacer" />
      </view>

      <view class="settings-card">
        <button class="settings-row" @tap="view = 'timer'">
          <text class="settings-label">定时关闭</text>
          <view class="settings-value-group">
            <text class="settings-value">{{ timerLabel }}</text>
            <text class="settings-chevron">›</text>
          </view>
        </button>
        <button class="settings-row" @tap="view = 'rate'">
          <text class="settings-label">语速</text>
          <view class="settings-value-group">
            <text class="settings-value">{{ playbackRateLabel }}x</text>
            <text class="settings-chevron">›</text>
          </view>
        </button>
        <view class="settings-row">
          <text class="settings-label">音色</text>
          <view class="settings-value-group">
            <text class="settings-value">升级版</text>
            <text class="settings-chevron">›</text>
          </view>
        </view>
      </view>
    </template>

    <template v-else-if="view === 'timer'">
      <view class="sheet-heading">
        <button class="sheet-back" aria-label="关闭定时关闭设置" @tap="close">⌄</button>
        <text class="sheet-title">定时关闭</text>
        <view class="sheet-heading-spacer" />
      </view>

      <view v-if="timerEnabled" class="timer-switch">
        <text class="timer-switch-label">{{ remainingTimerLabel }}</text>
        <switch :checked="timerEnabled" color="#ff6b3d" @change="changeTimer" />
      </view>

      <view class="timer-section">
        <text class="timer-section-title">按章节</text>
        <view class="timer-options">
          <button
            v-for="item in CHAPTER_TIMERS"
            :key="item.count"
            class="timer-option"
            :class="{
              selected:
                props.sleepTimer.mode === 'chapters' &&
                props.sleepTimer.totalChapters === item.count
            }"
            @tap="selectChapterTimer(item.count)"
          >
            {{ item.label }}
          </button>
        </view>
      </view>

      <view class="timer-section">
        <text class="timer-section-title">按时间</text>
        <view class="timer-options timer-options--minutes">
          <button
            v-for="item in MINUTE_TIMERS"
            :key="item"
            class="timer-option"
            :class="{
              selected:
                props.sleepTimer.mode === 'time' &&
                props.sleepTimer.durationSeconds === Number(item.replace('分钟', '')) * 60
            }"
            @tap="selectMinuteTimer(Number(item.replace('分钟', '')))"
          >
            {{ item }}
          </button>
        </view>
      </view>

      <button
        class="custom-time-button"
        :class="{ selected: customTimerSelected }"
        @tap="view = 'custom'"
      >
        自定义时长
        <text class="custom-time-chevron">›</text>
      </button>
    </template>

    <template v-else-if="view === 'rate'">
      <view class="sheet-heading">
        <button class="sheet-back" aria-label="关闭语速设置" @tap="close">⌄</button>
        <text class="sheet-title">语速</text>
        <button
          class="rate-reset"
          :class="{ active: props.playbackRate !== 1 }"
          @tap="emit('resetPlaybackRate')"
        >
          重置
        </button>
      </view>

      <view class="rate-heading-row">
        <text class="rate-current">语速 · {{ playbackRateLabel }}x</text>
        <view class="rate-book-only">
          <text>仅对本书生效</text>
          <switch
            :checked="props.rateOnlyForBook"
            color="#ff6b3d"
            @change="changeRateOnlyForBook"
          />
        </view>
      </view>

      <view class="rate-control">
        <slider
          class="rate-slider"
          :value="playbackRateSliderValue"
          :min="5"
          :max="20"
          :step="1"
          :active-color="playbackRateActiveColor"
          :background-color="playbackRateTrackColor"
          block-color="#ffffff"
          :block-size="30"
          @change="changePlaybackRate"
        />
        <view class="rate-marks">
          <view v-for="rate in RATE_MARKS" :key="rate" class="rate-mark">
            <view class="rate-tick" />
            <text>{{ rate.toFixed(1) }}</text>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="custom-actions">
        <button class="custom-action-button" @tap="view = 'timer'">取消</button>
        <button class="custom-action-button custom-action-button--confirm" @tap="confirmCustomTime">
          确认
        </button>
      </view>
      <view
        class="time-picker-shell"
        :class="{ 'time-picker-shell--dark': resolvedTheme === 'dark' }"
      >
        <picker-view
          class="time-picker"
          :value="pickerValue"
          :indicator-style="pickerIndicatorStyle"
          @change="changePicker"
        >
          <picker-view-column>
            <view v-for="hour in HOURS" :key="hour" class="picker-option">{{ hour }}小时</view>
          </picker-view-column>
          <picker-view-column>
            <view v-for="minute in MINUTES" :key="minute" class="picker-option">
              {{ minute }}分钟
            </view>
          </picker-view-column>
        </picker-view>
      </view>
    </template>
  </BottomSheet>
</template>

<style scoped>
.sheet-heading {
  display: grid;
  grid-template-columns: 72rpx 1fr 72rpx;
  align-items: center;
  min-height: 88rpx;
}

.sheet-back {
  position: relative;
  display: grid;
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  color: var(--reader-ink);
  background: transparent;
  border: 0;
  font-size: 50rpx;
  font-weight: 500;
  line-height: 1;
  place-items: center;
}

.sheet-back:active {
  background: var(--accent-soft);
  border-radius: 50%;
}

.sheet-title {
  color: var(--reader-ink);
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
}

.sheet-heading-spacer {
  width: 72rpx;
}

.settings-card {
  overflow: hidden;
  margin-top: 18rpx;
  background: var(--surface-strong);
  border-radius: 22rpx;
}

.settings-row {
  display: flex;
  width: 100%;
  min-height: 114rpx;
  margin: 0;
  padding: 0 28rpx;
  align-items: center;
  justify-content: space-between;
  color: var(--reader-ink);
  background: transparent;
  border: 0;
  border-radius: 0;
  text-align: left;
}

.settings-row + .settings-row {
  border-top: 1rpx solid var(--line);
}

.settings-row:active {
  background: var(--accent-soft);
}

.settings-label {
  font-size: 31rpx;
}

.settings-value-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.settings-value {
  color: #aaa8a4;
  font-size: 29rpx;
}

.settings-chevron {
  color: #aaa8a4;
  font-size: 38rpx;
  line-height: 1;
}

.rate-reset {
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  color: #aaa8a4;
  background: transparent;
  border: 0;
  font-size: 28rpx;
  line-height: 72rpx;
  text-align: center;
}

.rate-reset.active {
  color: var(--reader-ink);
}

.rate-heading-row {
  display: flex;
  min-height: 100rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 1rpx solid var(--line);
}

.rate-current {
  color: var(--reader-ink);
  font-size: 30rpx;
  font-weight: 700;
}

.rate-book-only {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #aaa8a4;
  font-size: 27rpx;
  white-space: nowrap;
}

.rate-book-only switch {
  transform: scale(0.82);
}

.rate-control {
  padding: 30rpx 8rpx 16rpx;
}

.rate-slider {
  margin: 0 14rpx;
}

.rate-marks {
  display: flex;
  margin-top: 12rpx;
  justify-content: space-between;
}

.rate-mark {
  display: flex;
  width: 44rpx;
  align-items: center;
  flex-direction: column;
  gap: 10rpx;
  color: #aaa8a4;
  font-size: 24rpx;
}

.rate-tick {
  width: 1rpx;
  height: 16rpx;
  background: var(--line);
}

.timer-section {
  margin-top: 28rpx;
}

.timer-switch {
  display: flex;
  min-height: 104rpx;
  margin-top: 8rpx;
  padding: 0 4rpx;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid var(--line);
}

.timer-switch-label {
  color: var(--reader-ink);
  font-size: 30rpx;
  font-weight: 600;
}

.timer-section-title {
  color: var(--reader-ink);
  font-size: 31rpx;
  font-weight: 700;
}

.timer-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 20rpx;
}

.timer-options--minutes {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.timer-option {
  height: 72rpx;
  margin: 0;
  padding: 0 12rpx;
  color: var(--reader-ink);
  background: var(--surface-strong);
  border: 1rpx solid transparent;
  border-radius: 999rpx;
  font-size: 27rpx;
  line-height: 72rpx;
}

.timer-option.selected {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
  font-weight: 700;
}

.custom-time-button {
  display: flex;
  width: 100%;
  height: 82rpx;
  margin: 34rpx 0 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  color: var(--reader-ink);
  background: transparent;
  border: 0;
  font-size: 29rpx;
}

.custom-time-button.selected {
  color: var(--accent);
  font-weight: 700;
}

.custom-time-chevron {
  color: #aaa8a4;
  font-size: 34rpx;
}

.custom-actions {
  display: flex;
  height: 90rpx;
  align-items: center;
  justify-content: space-between;
}

.custom-action-button {
  height: 72rpx;
  margin: 0;
  padding: 0 8rpx;
  color: var(--reader-ink);
  background: transparent;
  border: 0;
  font-size: 30rpx;
  line-height: 72rpx;
}

.custom-action-button--confirm {
  color: #ff6b3d;
  font-weight: 700;
}

.time-picker {
  width: 100%;
  height: 460rpx;
}

.time-picker-shell {
  overflow: hidden;
  margin: 0 -12rpx;
  background: linear-gradient(
    to bottom,
    var(--input-bg) 0%,
    var(--surface) 39%,
    var(--surface-strong) 39%,
    var(--surface-strong) 61%,
    var(--surface) 61%,
    var(--input-bg) 100%
  );
}

.custom-duration-sheet {
  --bottom-sheet-bg: var(--toolbar-bg);
}

.custom-duration-sheet--dark {
  --bottom-sheet-bg: #111;
}

.time-picker-shell--dark {
  background: linear-gradient(
    to bottom,
    #090909 0%,
    #111 39%,
    #3c3c3c 39%,
    #3c3c3c 61%,
    #111 61%,
    #090909 100%
  );
}

.time-picker picker-view-column:first-child {
  border-right: 1rpx solid var(--line);
}

.picker-option {
  display: flex;
  height: 96rpx;
  align-items: center;
  justify-content: center;
  color: var(--reader-ink);
  font-size: 38rpx;
}

.time-picker-shell--dark .picker-option {
  color: #fff;
}
</style>
