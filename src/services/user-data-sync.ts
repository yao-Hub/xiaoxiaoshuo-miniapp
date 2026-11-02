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

export function syncUserDataFromServer() {
  if (!canSyncUserData()) {
    return Promise.resolve(false)
  }
  syncPromise ||= runSync().finally(() => {
    syncPromise = undefined
  })
  return syncPromise
}

async function runSync() {
  try {
    const data = await getUserData()
    const localSearch = getSearchHistory()
    const localReading = getReadingHistory()

    if (data.searchHistory.length) {
      replaceSearchHistory(data.searchHistory)
    } else if (localSearch.length) {
      for (const query of [...localSearch].reverse()) {
        await saveSearchHistoryToServer(query)
      }
    }

    if (data.readingHistory.length) {
      replaceReadingHistory(data.readingHistory)
    } else if (localReading.length) {
      for (const item of [...localReading].reverse()) {
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
