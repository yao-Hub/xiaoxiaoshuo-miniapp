import { ref } from 'vue'

export type AudiobookSleepTimerMode = 'off' | 'time' | 'chapters'

export interface AudiobookSleepTimerState {
  mode: AudiobookSleepTimerMode
  durationSeconds: number
  remainingSeconds: number
  totalChapters: number
  remainingChapters: number
  stoppedByTimer: boolean
}

function createOffState(): AudiobookSleepTimerState {
  return {
    mode: 'off',
    durationSeconds: 0,
    remainingSeconds: 0,
    totalChapters: 0,
    remainingChapters: 0,
    stoppedByTimer: false
  }
}

export function useAudiobookSleepTimer(onExpire: (mode: 'time' | 'chapters') => void) {
  const state = ref<AudiobookSleepTimerState>(createOffState())
  let clockTimer: ReturnType<typeof setInterval> | undefined
  let endAt = 0

  function stopClock() {
    if (clockTimer) {
      clearInterval(clockTimer)
      clockTimer = undefined
    }
  }

  function expire(mode: 'time' | 'chapters') {
    stopClock()
    endAt = 0
    state.value = {
      ...createOffState(),
      stoppedByTimer: true
    }
    onExpire(mode)
  }

  function tick() {
    const remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    state.value = {
      ...state.value,
      remainingSeconds
    }
    if (remainingSeconds === 0) {
      expire('time')
    }
  }

  function setMinutes(minutes: number) {
    const normalizedMinutes = Math.max(1, Math.round(minutes))
    stopClock()
    const durationSeconds = normalizedMinutes * 60
    endAt = Date.now() + durationSeconds * 1000
    state.value = {
      mode: 'time',
      durationSeconds,
      remainingSeconds: durationSeconds,
      totalChapters: 0,
      remainingChapters: 0,
      stoppedByTimer: false
    }
    clockTimer = setInterval(tick, 1000)
  }

  function setChapters(chapters: 1 | 3 | 5) {
    stopClock()
    endAt = 0
    state.value = {
      mode: 'chapters',
      durationSeconds: 0,
      remainingSeconds: 0,
      totalChapters: chapters,
      remainingChapters: chapters,
      stoppedByTimer: false
    }
  }

  function cancel() {
    stopClock()
    endAt = 0
    state.value = createOffState()
  }

  function checkNow() {
    if (state.value.stoppedByTimer) {
      return false
    }
    if (state.value.mode !== 'time') {
      return true
    }
    tick()
    return !state.value.stoppedByTimer
  }

  function shouldContinueAfterChapterEnd() {
    if (!checkNow()) {
      return false
    }
    if (state.value.mode === 'chapters') {
      if (state.value.remainingChapters <= 1) {
        expire('chapters')
        return false
      }
      state.value = {
        ...state.value,
        remainingChapters: state.value.remainingChapters - 1
      }
    }
    return true
  }

  function clearStoppedByTimer() {
    if (state.value.stoppedByTimer) {
      state.value = {
        ...state.value,
        stoppedByTimer: false
      }
    }
  }

  return {
    state,
    setMinutes,
    setChapters,
    cancel,
    checkNow,
    shouldContinueAfterChapterEnd,
    clearStoppedByTimer
  }
}
