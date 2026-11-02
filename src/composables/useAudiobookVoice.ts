import { ref } from 'vue'
import { DEFAULT_AUDIOBOOK_VOICE_ID } from '@/constants/audiobook'
import { getTtsVoices } from '@/services/tts'
import { saveFavoriteVoiceToServer, saveUserSettingToServer } from '@/services/user-data'
import type { TtsVoiceOption } from '@/types/tts'

const STORAGE_KEY = 'audiobook_voice'

function loadVoice() {
  const stored = String(uni.getStorageSync(STORAGE_KEY) || '').trim()
  return stored || DEFAULT_AUDIOBOOK_VOICE_ID
}

export function useAudiobookVoice() {
  const voiceId = ref(loadVoice())
  const voices = ref<TtsVoiceOption[]>([])
  const currentVoice = ref<TtsVoiceOption>()
  const loading = ref(false)
  const errorMessage = ref('')
  let requestId = 0

  async function loadVoices() {
    const currentRequestId = ++requestId
    loading.value = true
    errorMessage.value = ''
    try {
      const catalog = await getTtsVoices('all')
      if (currentRequestId !== requestId) {
        return
      }
      voices.value = catalog.voices
      const selected = catalog.voices.find((voice) => voice.id === voiceId.value)
      if (selected) {
        currentVoice.value = selected
      } else {
        currentVoice.value =
          catalog.voices.find((voice) => voice.id === catalog.defaultVoiceId) || catalog.voices[0]
        if (currentVoice.value) {
          voiceId.value = currentVoice.value.id
          uni.setStorageSync(STORAGE_KEY, currentVoice.value.id)
        }
      }
    } catch (error) {
      if (currentRequestId === requestId) {
        errorMessage.value = error instanceof Error ? error.message : '音色加载失败'
      }
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
      }
    }
  }

  function setVoice(value: string) {
    const voice = voices.value.find((item) => item.id === value)
    if (!voice || voice.id === voiceId.value) {
      return
    }
    voiceId.value = voice.id
    currentVoice.value = voice
    uni.setStorageSync(STORAGE_KEY, voice.id)
    void saveUserSettingToServer('audiobook_voice', { voiceId: voice.id }).catch(() => undefined)
  }

  function setVoiceFavorite(value: string, favorite: boolean) {
    const current = voices.value.find((voice) => voice.id === value)!
    const currentVoiceValue = currentVoice.value
    voices.value = voices.value.map((voice) =>
      voice.id === value ? { ...voice, favorite } : voice
    )
    if (currentVoiceValue?.id === value) {
      currentVoice.value = { ...currentVoiceValue, favorite }
    }
    void saveFavoriteVoiceToServer(value, favorite)
      .then(() => {
        uni.showToast({
          title: favorite ? '已收藏' : '已取消收藏',
          icon: 'none'
        })
      })
      .catch(() => {
        voices.value = voices.value.map((voice) =>
          voice.id === value ? { ...voice, favorite: current.favorite } : voice
        )
        if (currentVoiceValue?.id === value) {
          currentVoice.value = currentVoiceValue
        }
        uni.showToast({
          title: '收藏操作失败，请重试',
          icon: 'none'
        })
      })
  }

  function reloadVoice() {
    voiceId.value = loadVoice()
    currentVoice.value = voices.value.find((voice) => voice.id === voiceId.value)
  }

  return {
    voiceId,
    voices,
    currentVoice,
    loading,
    errorMessage,
    loadVoices,
    setVoice,
    setVoiceFavorite,
    reloadVoice
  }
}
