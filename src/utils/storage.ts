import type { ReadingHistoryItem } from '@/types/novel'

const SEARCH_HISTORY_KEY = 'xiaoxiaoshuo.searchHistory'
const READING_HISTORY_KEY = 'xiaoxiaoshuo.readingHistory'
const MAX_HISTORY_ITEMS = 30

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
  const next = [item, ...getReadingHistory().filter((current) => current.key !== item.key)].slice(
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
