import type { ReadingHistoryItem } from '@/types/novel'
import {
  DEFAULT_READER_SETTINGS,
  READER_BRIGHTNESS_MIN,
  READER_FONT_SIZE_MAX,
  READER_FONT_SIZE_MIN,
  READER_PAGE_MODES,
  READER_SETTINGS_KEY
} from '@/constants/reader'
import type { ReaderSettings } from '@/types/reader'

const SEARCH_HISTORY_KEY = 'xiaoxiaoshuo.searchHistory'
const READING_HISTORY_KEY = 'xiaoxiaoshuo.readingHistory'
const MAX_HISTORY_ITEMS = 30

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

function readArray<T>(key: string): T[] {
  const value = uni.getStorageSync(key)
  return Array.isArray(value) ? value : []
}

export function getSearchHistory(): string[] {
  return readArray<string>(SEARCH_HISTORY_KEY).slice(0, MAX_HISTORY_ITEMS)
}

export function addSearchHistory(query: string) {
  const value = query.trim()
  if (!value) {
    return
  }
  const next = [value, ...getSearchHistory().filter((item) => item !== value)].slice(
    0,
    MAX_HISTORY_ITEMS
  )
  uni.setStorageSync(SEARCH_HISTORY_KEY, next)
}

export function removeSearchHistory(query: string) {
  uni.setStorageSync(
    SEARCH_HISTORY_KEY,
    getSearchHistory().filter((item) => item !== query)
  )
}

export function clearSearchHistory() {
  uni.removeStorageSync(SEARCH_HISTORY_KEY)
}

export function getReadingHistory(): ReadingHistoryItem[] {
  return readArray<ReadingHistoryItem>(READING_HISTORY_KEY)
    .filter((item) => item && item.key && item.chapterUrl)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_HISTORY_ITEMS)
}

export function rememberReading(item: ReadingHistoryItem) {
  const next = [
    {
      ...item,
      scrollTop: Math.max(0, item.scrollTop || 0),
      progress: Math.min(100, Math.max(0, item.progress || 0)),
      pageIndex: Math.max(0, item.pageIndex || 0)
    },
    ...getReadingHistory().filter((current) => current.key !== item.key)
  ].slice(0, MAX_HISTORY_ITEMS)
  uni.setStorageSync(READING_HISTORY_KEY, next)
}

export function getReadingRecord(chapterUrl: string) {
  return getReadingHistory().find((item) => item.chapterUrl === chapterUrl)
}

export function updateReadingProgress(input: {
  chapterUrl: string
  scrollTop: number
  progress: number
  pageIndex: number
  updatedAt?: number
}) {
  const items = getReadingHistory()
  const index = items.findIndex((item) => item.chapterUrl === input.chapterUrl)
  if (index < 0) {
    return
  }

  const current = items[index]
  const updated: ReadingHistoryItem = {
    ...current,
    scrollTop: Math.max(0, input.scrollTop),
    progress: Math.min(100, Math.max(0, input.progress)),
    pageIndex: Math.max(0, input.pageIndex),
    updatedAt: input.updatedAt || Date.now()
  }
  const next = [updated, ...items.filter((_, itemIndex) => itemIndex !== index)].slice(
    0,
    MAX_HISTORY_ITEMS
  )
  uni.setStorageSync(READING_HISTORY_KEY, next)
}

export function removeReadingHistory(key: string) {
  uni.setStorageSync(
    READING_HISTORY_KEY,
    getReadingHistory().filter((item) => item.key !== key)
  )
}

export function clearReadingHistory() {
  uni.removeStorageSync(READING_HISTORY_KEY)
}

export function getReaderSettings(): ReaderSettings {
  try {
    const value = uni.getStorageSync(READER_SETTINGS_KEY)
    if (!value || typeof value !== 'object') {
      return { ...DEFAULT_READER_SETTINGS }
    }

    const stored = value as Partial<ReaderSettings>
    const validPageMode = READER_PAGE_MODES.some((item) => item.value === stored.pageMode)
    return {
      fontSize: clampNumber(
        stored.fontSize,
        READER_FONT_SIZE_MIN,
        READER_FONT_SIZE_MAX,
        DEFAULT_READER_SETTINGS.fontSize
      ),
      brightness: clampNumber(
        stored.brightness,
        READER_BRIGHTNESS_MIN,
        100,
        DEFAULT_READER_SETTINGS.brightness
      ),
      pageMode: validPageMode ? stored.pageMode! : DEFAULT_READER_SETTINGS.pageMode
    }
  } catch {
    return { ...DEFAULT_READER_SETTINGS }
  }
}

export function saveReaderSettings(settings: ReaderSettings) {
  uni.setStorageSync(READER_SETTINGS_KEY, {
    fontSize: clampNumber(
      settings.fontSize,
      READER_FONT_SIZE_MIN,
      READER_FONT_SIZE_MAX,
      DEFAULT_READER_SETTINGS.fontSize
    ),
    brightness: clampNumber(
      settings.brightness,
      READER_BRIGHTNESS_MIN,
      100,
      DEFAULT_READER_SETTINGS.brightness
    ),
    pageMode: READER_PAGE_MODES.some((item) => item.value === settings.pageMode)
      ? settings.pageMode
      : DEFAULT_READER_SETTINGS.pageMode
  })
}
