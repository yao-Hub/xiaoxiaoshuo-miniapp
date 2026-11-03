import { clearAuthSession, getAuthToken } from '@/services/auth'
import { hasConfiguredApi, requestJson } from '@/services/http'
import type { ReadingHistoryItem } from '@/types/novel'

interface UserDataSnapshot {
  searchHistory: string[]
  readingHistory: ReadingHistoryItem[]
  settings: Record<string, unknown>
  favoriteVoiceIds: string[]
}

function requestOptions() {
  return {
    token: getAuthToken(),
    timeout: 15000,
    showLoading: false,
    forbiddenMessage: '当前内容暂不可用。',
    onUnauthorized: clearAuthSession
  }
}

function mutateUserData(path: string, data?: Record<string, unknown>) {
  if (!canSyncUserData()) {
    return Promise.resolve()
  }
  return requestJson<unknown>(path, {
    ...requestOptions(),
    method: 'POST',
    data
  }).then(() => undefined)
}

export function getUserData() {
  return requestJson<UserDataSnapshot>('/api/user/sync-data', requestOptions())
}

export function saveSearchHistoryToServer(query: string) {
  return mutateUserData('/api/user/search-history/save', { query })
}

export function removeSearchHistoryFromServer(query?: string) {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : ''
  return mutateUserData(`/api/user/search-history/remove${suffix}`)
}

export function saveReadingHistoryToServer(item: ReadingHistoryItem) {
  return mutateUserData('/api/user/reading-history/save', {
    ...item,
    coverUrl: item.coverUrl || '',
    scrollTop: item.scrollTop || 0,
    pageIndex: item.pageIndex || 0,
    progress: item.progress || 0
  })
}

export function removeReadingHistoryFromServer(key?: string) {
  const suffix = key ? `?key=${encodeURIComponent(key)}` : ''
  return mutateUserData(`/api/user/reading-history/remove${suffix}`)
}

export function saveUserSettingToServer(key: string, value: unknown) {
  return mutateUserData(`/api/user/settings/save/${encodeURIComponent(key)}`, {
    value
  })
}

export function saveFavoriteVoiceToServer(voiceId: string, favorite: boolean) {
  return mutateUserData('/api/user/favorite-voices/set', { voiceId, favorite })
}

export function canSyncUserData() {
  return hasConfiguredApi() && Boolean(getAuthToken())
}
