import {
  canSyncUserData,
  getUserData,
  saveReadingHistoryToServer,
  saveSearchHistoryToServer,
  saveUserSettingToServer
} from '@/services/user-data'
import {
  getReaderSettings,
  getReadingHistory,
  getSearchHistory,
  replaceReaderSettings,
  replaceReadingHistory,
  replaceSearchHistory
} from '@/utils/storage'
import { THEME_STORAGE_KEY } from '@/constants/theme'
import { normalizeThemeMode } from '@/utils/theme'

const PLAYBACK_RATE_STORAGE_KEY = 'audiobook_playback_rate'
const VOICE_STORAGE_KEY = 'audiobook_voice'

let syncPromise: Promise<boolean> | undefined
let initialSyncAttempted = false

export function syncUserDataFromServer(options: { showLoading?: boolean } = {}) {
  if (!canSyncUserData()) {
    return Promise.resolve(false)
  }
  const showLoading = options.showLoading ?? !initialSyncAttempted
  syncPromise ||= runSync(showLoading).finally(() => {
    syncPromise = undefined
    initialSyncAttempted = true
  })
  return syncPromise
}

async function runSync(showLoading: boolean) {
  try {
    const data = await getUserData({ showLoading })
    const localSearch = getSearchHistory()
    const localReading = getReadingHistory()

    const mergedSearch = Array.from(new Set([...localSearch, ...data.searchHistory]))
    replaceSearchHistory(mergedSearch)
    const currentSearch = getSearchHistory()
    const serverSearch = new Set(data.searchHistory)
    for (const query of [...currentSearch].reverse()) {
      if (!serverSearch.has(query)) {
        await saveSearchHistoryToServer(query)
      }
    }

    const serverReadingByKey = new Map(data.readingHistory.map((item) => [item.key, item]))
    const mergedReadingByKey = new Map(serverReadingByKey)
    for (const item of localReading) {
      const serverItem = mergedReadingByKey.get(item.key)
      if (!serverItem || item.updatedAt > serverItem.updatedAt) {
        mergedReadingByKey.set(item.key, item)
      }
    }
    replaceReadingHistory(
      [...mergedReadingByKey.values()].sort((left, right) => right.updatedAt - left.updatedAt)
    )
    for (const item of [...getReadingHistory()].reverse()) {
      const serverItem = serverReadingByKey.get(item.key)
      if (!serverItem || item.updatedAt > serverItem.updatedAt) {
        await saveReadingHistoryToServer(item)
      }
    }

    if (data.settings.reader) {
      replaceReaderSettings(data.settings.reader)
    } else {
      await saveUserSettingToServer('reader', getReaderSettings())
    }

    const playbackRate = data.settings.audiobook_playback_rate
    if (playbackRate && typeof playbackRate === 'object') {
      uni.setStorageSync(PLAYBACK_RATE_STORAGE_KEY, playbackRate)
    } else {
      const local = uni.getStorageSync(PLAYBACK_RATE_STORAGE_KEY)
      if (local && typeof local === 'object') {
        await saveUserSettingToServer('audiobook_playback_rate', local)
      }
    }

    const voice = data.settings.audiobook_voice
    if (voice && typeof voice === 'object' && 'voiceId' in voice) {
      uni.setStorageSync(VOICE_STORAGE_KEY, String(voice.voiceId || ''))
    } else {
      const local = uni.getStorageSync(VOICE_STORAGE_KEY)
      if (local) {
        await saveUserSettingToServer('audiobook_voice', { voiceId: String(local) })
      }
    }

    const serverTheme = data.settings.theme
    if (serverTheme === normalizeThemeMode(serverTheme)) {
      uni.setStorageSync(THEME_STORAGE_KEY, serverTheme)
    } else {
      const local = normalizeThemeMode(uni.getStorageSync(THEME_STORAGE_KEY))
      await saveUserSettingToServer('theme', local)
    }
    return true
  } catch {
    return false
  }
}
