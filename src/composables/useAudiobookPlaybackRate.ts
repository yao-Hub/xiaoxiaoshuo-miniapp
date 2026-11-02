import { ref } from 'vue'
import { saveUserSettingToServer } from '@/services/user-data'

const STORAGE_KEY = 'audiobook_playback_rate'
const DEFAULT_RATE = 1
const MIN_RATE = 0.5
const MAX_RATE = 2

interface PlaybackRateStorage {
  globalRate: number
  bookRates: Record<string, number>
}

function normalizeRate(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return DEFAULT_RATE
  }
  return Math.round(Math.min(MAX_RATE, Math.max(MIN_RATE, number)) * 10) / 10
}

function loadStorage(): PlaybackRateStorage {
  const stored = uni.getStorageSync(STORAGE_KEY) as Partial<PlaybackRateStorage> | undefined
  return {
    globalRate: normalizeRate(stored?.globalRate),
    bookRates:
      stored?.bookRates && typeof stored.bookRates === 'object' ? { ...stored.bookRates } : {}
  }
}

export function useAudiobookPlaybackRate() {
  const storage = loadStorage()
  const playbackRate = ref(storage.globalRate)
  const rateOnlyForBook = ref(false)
  let currentBookKey = ''

  function persist() {
    const value = {
      globalRate: storage.globalRate,
      bookRates: storage.bookRates
    }
    uni.setStorageSync(STORAGE_KEY, value)
    void saveUserSettingToServer('audiobook_playback_rate', value).catch(() => undefined)
  }

  function activateBook(bookKey: string) {
    currentBookKey = bookKey.trim()
    rateOnlyForBook.value =
      Boolean(currentBookKey) &&
      Object.prototype.hasOwnProperty.call(storage.bookRates, currentBookKey)
    playbackRate.value = normalizeRate(
      rateOnlyForBook.value ? storage.bookRates[currentBookKey] : storage.globalRate
    )
  }

  function setRate(value: number) {
    const rate = normalizeRate(value)
    playbackRate.value = rate
    if (rateOnlyForBook.value) {
      storage.bookRates[currentBookKey] = rate
    } else {
      storage.globalRate = rate
    }
    persist()
  }

  function setOnlyForBook(enabled: boolean) {
    rateOnlyForBook.value = enabled
    if (rateOnlyForBook.value) {
      storage.bookRates[currentBookKey] = playbackRate.value
    } else {
      delete storage.bookRates[currentBookKey]
      storage.globalRate = playbackRate.value
    }
    persist()
  }

  function reload() {
    const next = loadStorage()
    storage.globalRate = next.globalRate
    storage.bookRates = next.bookRates
    rateOnlyForBook.value =
      Boolean(currentBookKey) &&
      Object.prototype.hasOwnProperty.call(storage.bookRates, currentBookKey)
    playbackRate.value = normalizeRate(
      rateOnlyForBook.value ? storage.bookRates[currentBookKey] : storage.globalRate
    )
  }

  return {
    playbackRate,
    rateOnlyForBook,
    activateBook,
    reload,
    setRate,
    setOnlyForBook
  }
}
