<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AudiobookSettingsSheet from '@/components/audiobook/AudiobookSettingsSheet.vue'
import { useAudiobook } from '@/composables/useAudiobook'
import { setTabBarHidden } from '@/utils/tabbar'

const PLAYER_LEFT_RPX = 24
const PLAYER_WIDTH_RPX = 400
const PLAYER_HEIGHT_RPX = 120
const PLAYER_EDGE_PX = 8
const DRAG_THRESHOLD_PX = 6
const TAP_SUPPRESSION_MS = 180

const props = withDefaults(
  defineProps<{
    placement?: 'default' | 'above-tab' | 'above-toolbar'
    hidden?: boolean
  }>(),
  {
    placement: 'default',
    hidden: false
  }
)

const audiobook = useAudiobook()
const coverFailed = ref(false)
const dragging = ref(false)
const systemInfo = uni.getSystemInfoSync()
const windowWidth = systemInfo.windowWidth || 375
const windowHeight = systemInfo.windowHeight || systemInfo.screenHeight || 667
const screenHeight = systemInfo.screenHeight || windowHeight
const safeAreaBottom = Math.max(0, screenHeight - (systemInfo.safeArea?.bottom ?? screenHeight))
const playerWidth = Math.min(
  uni.upx2px(PLAYER_WIDTH_RPX),
  windowWidth - uni.upx2px(PLAYER_LEFT_RPX * 2)
)
const playerHeight = uni.upx2px(PLAYER_HEIGHT_RPX)
let dragStartX = 0
let dragStartY = 0
let dragOriginLeft = 0
let dragOriginBottom = 0
let suppressTapUntil = 0

const coverLetter = computed(() => audiobook.chapterTitle.value.trim().slice(0, 1) || '书')
const playerStyle = computed(() => {
  const position = audiobook.playerPosition.value
  if (!position) {
    return undefined
  }
  const resolved = clampPosition(position)
  return {
    left: `${resolved.left}px`,
    bottom: `${resolved.bottom}px`
  }
})

watch(audiobook.coverUrl, () => {
  coverFailed.value = false
})

watch(audiobook.settingsVisible, setTabBarHidden, { immediate: true })

function getPlacementBottom(edge: number) {
  if (props.placement === 'above-toolbar') {
    return uni.upx2px(216) + safeAreaBottom
  }
  if (props.placement === 'above-tab') {
    return uni.upx2px(128) + safeAreaBottom
  }
  return edge + safeAreaBottom
}

function getMinimumBottom() {
  return getPlacementBottom(PLAYER_EDGE_PX)
}

function clampPosition(position: { left: number; bottom: number }) {
  const minimumLeft = PLAYER_EDGE_PX
  const maximumLeft = Math.max(minimumLeft, windowWidth - playerWidth - PLAYER_EDGE_PX)
  const minimumBottom = getMinimumBottom()
  const maximumBottom = Math.max(minimumBottom, windowHeight - playerHeight - PLAYER_EDGE_PX)
  return {
    left: Math.min(maximumLeft, Math.max(minimumLeft, position.left)),
    bottom: Math.min(maximumBottom, Math.max(minimumBottom, position.bottom))
  }
}

function getDefaultPosition() {
  return clampPosition({
    left: uni.upx2px(PLAYER_LEFT_RPX),
    bottom: getPlacementBottom(uni.upx2px(28))
  })
}

function getTouchPoint(event: TouchEvent) {
  const touch = event.touches[0] || event.changedTouches[0]
  return { x: touch.clientX, y: touch.clientY }
}

function handleDragStart(event: TouchEvent) {
  const point = getTouchPoint(event)
  const origin = audiobook.playerPosition.value
    ? clampPosition(audiobook.playerPosition.value)
    : getDefaultPosition()
  dragStartX = point.x
  dragStartY = point.y
  dragOriginLeft = origin.left
  dragOriginBottom = origin.bottom
  dragging.value = false
}

function handleDragMove(event: TouchEvent) {
  const point = getTouchPoint(event)
  const deltaX = point.x - dragStartX
  const deltaY = point.y - dragStartY
  const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
  if (!dragging.value && dragDistance < DRAG_THRESHOLD_PX) {
    return
  }
  dragging.value = true
  audiobook.setPlayerPosition(
    clampPosition({
      left: dragOriginLeft + deltaX,
      bottom: dragOriginBottom - deltaY
    })
  )
}

function handleDragEnd() {
  if (dragging.value) {
    suppressTapUntil = Date.now() + TAP_SUPPRESSION_MS
  }
  dragging.value = false
}

function runPlayerAction(action: () => void) {
  if (Date.now() < suppressTapUntil) {
    return
  }
  action()
}

function openReader() {
  const chapterUrl = audiobook.chapterUrl.value
  const pages = getCurrentPages()
  const currentIndex = pages.length - 1
  if (pages[currentIndex]?.route === 'pages/reader/reader') {
    return
  }
  const readerIndex = pages.findIndex((page) => page.route === 'pages/reader/reader')
  if (readerIndex >= 0 && readerIndex < currentIndex) {
    uni.navigateBack({ delta: currentIndex - readerIndex })
    return
  }
  const catalogUrl = audiobook.catalogUrl.value
  const bookTitleValue = audiobook.bookTitle.value
  const coverUrl = audiobook.coverUrl.value
  uni.navigateTo({
    url: `/pages/reader/reader?chapterUrl=${encodeURIComponent(chapterUrl)}&catalogUrl=${encodeURIComponent(catalogUrl)}&bookTitle=${encodeURIComponent(bookTitleValue)}&coverUrl=${encodeURIComponent(coverUrl)}`
  })
}
</script>

<template>
  <view
    v-if="audiobook.visible.value && !props.hidden"
    class="audio-player"
    :class="{
      'above-tab': props.placement === 'above-tab' && !audiobook.playerPosition.value,
      'above-toolbar': props.placement === 'above-toolbar' && !audiobook.playerPosition.value,
      dragging: dragging,
      playing: audiobook.playing.value,
      loading: audiobook.loading.value,
      error: Boolean(audiobook.errorMessage.value)
    }"
    :style="playerStyle"
    @touchstart="handleDragStart"
    @touchmove.stop.prevent="handleDragMove"
    @touchend="handleDragEnd"
    @touchcancel="handleDragEnd"
    @tap.stop
  >
    <button class="cover-shell" aria-label="返回正文" @tap="runPlayerAction(openReader)">
      <image
        v-if="audiobook.coverUrl.value && !coverFailed"
        class="cover-image"
        :src="audiobook.coverUrl.value"
        mode="aspectFill"
        @error="coverFailed = true"
      />
      <view v-else class="cover-fallback">{{ coverLetter }}</view>
    </button>

    <button
      class="play-control"
      :disabled="audiobook.loading.value"
      :aria-label="audiobook.playing.value ? '暂停听书' : '继续听书'"
      @tap="runPlayerAction(audiobook.togglePlay)"
    >
      <view class="play-control-inner">
        <text v-if="audiobook.errorMessage.value" class="play-symbol error-symbol">!</text>
        <text v-else-if="audiobook.loading.value" class="play-symbol">•••</text>
        <view v-else-if="audiobook.playing.value" class="pause-symbol">
          <view class="pause-bar" />
          <view class="pause-bar" />
        </view>
        <view v-else class="play-symbol-triangle" />
      </view>
    </button>

    <button
      class="settings-button"
      aria-label="听书设置"
      @tap="runPlayerAction(audiobook.openSettings)"
    >
      <view class="secondary-control-inner">
        <view class="tune-icon" aria-hidden="true">
          <view class="tune-row">
            <view class="tune-line" />
            <view class="tune-knob tune-knob--right" />
          </view>
          <view class="tune-row">
            <view class="tune-line" />
            <view class="tune-knob tune-knob--left" />
          </view>
          <view class="tune-row">
            <view class="tune-line" />
            <view class="tune-knob tune-knob--center" />
          </view>
        </view>
      </view>
    </button>

    <button class="close-button" aria-label="关闭听书" @tap="runPlayerAction(audiobook.close)">
      <view class="secondary-control-inner">
        <view class="close-icon" aria-hidden="true">
          <view class="close-line" />
          <view class="close-line" />
        </view>
      </view>
    </button>
  </view>

  <AudiobookSettingsSheet
    v-if="audiobook.settingsVisible.value"
    :sleep-timer="audiobook.sleepTimer.value"
    :playback-rate="audiobook.playbackRate.value"
    :rate-only-for-book="audiobook.rateOnlyForBook.value"
    :voice-id="audiobook.voiceId.value"
    :voice-options="audiobook.voiceOptions.value"
    :voice-loading="audiobook.voiceLoading.value"
    :voice-error="audiobook.voiceError.value"
    :current-voice="audiobook.currentVoice.value"
    @close="audiobook.closeSettings"
    @set-timer-minutes="audiobook.setSleepTimerByMinutes"
    @set-timer-chapters="audiobook.setSleepTimerByChapters"
    @cancel-timer="audiobook.cancelSleepTimer"
    @set-playback-rate="audiobook.setPlaybackRate"
    @set-rate-only-for-book="audiobook.setRateOnlyForBook"
    @reset-playback-rate="audiobook.resetPlaybackRate"
    @set-voice="audiobook.setPlaybackVoice"
    @set-voice-favorite="audiobook.setVoiceFavorite"
    @load-voices="audiobook.loadVoices"
  />
</template>

<style scoped>
.audio-player {
  position: fixed;
  bottom: calc(28rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  z-index: 26;
  display: flex;
  width: calc(100% - 48rpx);
  max-width: 400rpx;
  height: 120rpx;
  padding: 12rpx;
  align-items: center;
  justify-content: flex-start;
  gap: 20rpx;
  color: var(--reader-ink);
  background: linear-gradient(
    145deg,
    var(--surface-strong) 0%,
    var(--surface) 55%,
    var(--input-bg) 100%
  );
  border: 1rpx solid var(--line);
  border-radius: 999rpx;
  box-shadow:
    0 16rpx 44rpx var(--shadow),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
  transition: bottom 160ms ease;
}

.audio-player.above-tab {
  bottom: calc(128rpx + env(safe-area-inset-bottom));
}

.audio-player.above-toolbar {
  bottom: calc(216rpx + env(safe-area-inset-bottom));
}

.audio-player.dragging {
  transition: none;
}

.cover-shell {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  flex: 0 0 88rpx;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background: var(--gold);
  border: 2rpx solid rgba(255, 255, 255, 0.46);
  border-radius: 50%;
  box-shadow: 0 8rpx 22rpx rgba(0, 0, 0, 0.18);
  animation: cover-spin 10s linear infinite;
  animation-play-state: paused;
  place-items: center;
}

.playing .cover-shell {
  animation-play-state: running;
}

.cover-image,
.cover-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.cover-fallback {
  display: grid;
  color: var(--button-ink);
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.5), transparent 42%), var(--gold);
  font-size: 32rpx;
  font-weight: 800;
  place-items: center;
}

.play-control,
.settings-button,
.close-button {
  display: grid;
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 5rpx;
  flex: 0 0 72rpx;
  background: transparent;
  border: 0;
  border-radius: 50%;
  place-items: center;
}

.play-control-inner,
.secondary-control-inner {
  display: grid;
  width: 100%;
  height: 100%;
  color: var(--reader-ink);
  background: var(--toolbar-bg);
  border-radius: 50%;
  place-items: center;
}

.secondary-control-inner {
  color: var(--reader-ink);
  background: var(--toolbar-bg);
  border: 1rpx solid var(--line);
}

.settings-button .secondary-control-inner {
  border: 0;
}

.play-symbol {
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1;
}

.error-symbol {
  color: var(--danger);
}

.pause-symbol {
  display: flex;
  gap: 6rpx;
}

.pause-bar {
  width: 6rpx;
  height: 22rpx;
  background: currentColor;
  border-radius: 999rpx;
}

.play-symbol-triangle {
  width: 0;
  height: 0;
  margin-left: 4rpx;
  border-top: 12rpx solid transparent;
  border-bottom: 12rpx solid transparent;
  border-left: 18rpx solid currentColor;
}

.error .play-control-inner {
  color: var(--danger);
}

.settings-button:active,
.close-button:active {
  background: var(--accent-soft);
}

.tune-icon {
  position: relative;
  display: flex;
  width: 34rpx;
  height: 28rpx;
  flex-direction: column;
  justify-content: space-between;
}

.tune-row {
  position: relative;
  width: 34rpx;
  height: 2rpx;
}

.tune-line {
  position: absolute;
  inset: 0;
  background: currentColor;
  border-radius: 999rpx;
}

.tune-knob {
  position: absolute;
  top: -5rpx;
  width: 12rpx;
  height: 12rpx;
  background: var(--toolbar-bg);
  border: 2rpx solid currentColor;
  border-radius: 50%;
}

.tune-knob--right {
  right: 2rpx;
}

.tune-knob--left {
  left: 5rpx;
}

.tune-knob--center {
  left: 11rpx;
}

.close-control-inner {
  color: var(--muted);
}

.close-icon {
  position: relative;
  width: 30rpx;
  height: 30rpx;
}

.close-line {
  position: absolute;
  top: 14rpx;
  left: 0;
  width: 30rpx;
  height: 2rpx;
  background: currentColor;
  border-radius: 999rpx;
}

.close-line:first-child {
  transform: rotate(45deg);
}

.close-line:last-child {
  transform: rotate(-45deg);
}

@keyframes cover-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
