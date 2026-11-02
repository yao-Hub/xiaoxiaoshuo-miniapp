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
import {
  removeReadingHistoryFromServer,
  removeSearchHistoryFromServer,
  saveReadingHistoryToServer,
  saveSearchHistoryToServer,
  saveUserSettingToServer
} from '@/services/user-data'

const SEARCH_HISTORY_KEY = 'xiaoxiaoshuo.searchHistory'
const READING_HISTORY_KEY = 'xiaoxiaoshuo.readingHistory'
const MAX_HISTORY_ITEMS = 30
const READING_HISTORY_SYNC_DELAY_MS = 1000
let readingHistorySyncTimer: ReturnType<typeof setTimeout> | undefined
let pendingReadingHistory: ReadingHistoryItem | undefined

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

function readArray<T>(key: string): T[] {
  const value = uni.getStorageSync(key)
  return Array.isArray(value) ? value : []
}

function normalizeReadingHistory(items: ReadingHistoryItem[]) {
  return items
    .filter((item) => item && item.key && item.chapterUrl)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_HISTORY_ITEMS)
}

export function getSearchHistory(): string[] {
  return readArray<string>(SEARCH_HISTORY_KEY).slice(0, MAX_HISTORY_ITEMS)
}

export function replaceSearchHistory(items: string[]) {
  uni.setStorageSync(SEARCH_HISTORY_KEY, Array.from(new Set(items)).slice(0, MAX_HISTORY_ITEMS))
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
  void saveSearchHistoryToServer(value).catch(() => undefined)
}

export function removeSearchHistory(query: string) {
  uni.setStorageSync(
    SEARCH_HISTORY_KEY,
    getSearchHistory().filter((item) => item !== query)
  )
  void removeSearchHistoryFromServer(query).catch(() => undefined)
}

export function clearSearchHistory() {
  uni.removeStorageSync(SEARCH_HISTORY_KEY)
  void removeSearchHistoryFromServer().catch(() => undefined)
}

export function getReadingHistory(): ReadingHistoryItem[] {
  return normalizeReadingHistory(readArray<ReadingHistoryItem>(READING_HISTORY_KEY))
}

export function replaceReadingHistory(items: ReadingHistoryItem[]) {
  uni.setStorageSync(READING_HISTORY_KEY, normalizeReadingHistory(items))
}

export function rememberReading(item: ReadingHistoryItem) {
  const normalized = {
    ...item,
    scrollTop: Math.max(0, item.scrollTop || 0),
    progress: Math.min(100, Math.max(0, item.progress || 0)),
    pageIndex: Math.max(0, item.pageIndex || 0)
  }
  const next = [
    normalized,
    ...getReadingHistory().filter((current) => current.key !== item.key)
  ].slice(0, MAX_HISTORY_ITEMS)
  uni.setStorageSync(READING_HISTORY_KEY, next)
  void saveReadingHistoryToServer(normalized).catch(() => undefined)
}

export function getReadingRecord(chapterUrl: string) {
  return getReadingHistory().find((item) => item.chapterUrl === chapterUrl)
}

export function updateReadingProgress(input: {
  chapterUrl: string
  scrollTop: number
  progress: number
  pageIndex: number
  coverUrl?: string
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
    coverUrl: input.coverUrl || current.coverUrl,
    updatedAt: input.updatedAt || Date.now()
  }
  const next = [updated, ...items.filter((_, itemIndex) => itemIndex !== index)].slice(
    0,
    MAX_HISTORY_ITEMS
  )
  uni.setStorageSync(READING_HISTORY_KEY, next)
  queueReadingHistorySync(updated)
}

export function removeReadingHistory(key: string) {
  clearReadingHistorySync()
  uni.setStorageSync(
    READING_HISTORY_KEY,
    getReadingHistory().filter((item) => item.key !== key)
  )
  void removeReadingHistoryFromServer(key).catch(() => undefined)
}

export function clearReadingHistory() {
  clearReadingHistorySync()
  uni.removeStorageSync(READING_HISTORY_KEY)
  void removeReadingHistoryFromServer().catch(() => undefined)
}

export function getReaderSettings(): ReaderSettings {
  return normalizeReaderSettings(uni.getStorageSync(READER_SETTINGS_KEY))
}

export function saveReaderSettings(settings: ReaderSettings) {
  const normalized = normalizeReaderSettings(settings)
  uni.setStorageSync(READER_SETTINGS_KEY, normalized)
  void saveUserSettingToServer('reader', normalized).catch(() => undefined)
}

export function replaceReaderSettings(settings: unknown) {
  uni.setStorageSync(READER_SETTINGS_KEY, normalizeReaderSettings(settings))
}

function normalizeReaderSettings(value: unknown): ReaderSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_READER_SETTINGS }
  }
  const stored = value as Partial<ReaderSettings>
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
    pageMode: READER_PAGE_MODES.some((item) => item.value === stored.pageMode)
      ? stored.pageMode!
      : DEFAULT_READER_SETTINGS.pageMode
  }
}

function queueReadingHistorySync(item: ReadingHistoryItem) {
  pendingReadingHistory = item
  if (readingHistorySyncTimer) {
    clearTimeout(readingHistorySyncTimer)
  }
  readingHistorySyncTimer = setTimeout(() => {
    readingHistorySyncTimer = undefined
    const pending = pendingReadingHistory as ReadingHistoryItem
    pendingReadingHistory = undefined
    void saveReadingHistoryToServer(pending).catch(() => undefined)
  }, READING_HISTORY_SYNC_DELAY_MS)
}

function clearReadingHistorySync() {
  if (readingHistorySyncTimer) {
    clearTimeout(readingHistorySyncTimer)
    readingHistorySyncTimer = undefined
  }
  pendingReadingHistory = undefined
}
