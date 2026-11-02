import { clearAuthSession, getAuthToken } from '@/services/auth'
import {
  ApiRequestError,
  hasConfiguredApi,
  requestJson,
  type RequestCancellation
} from '@/services/http'
import type { TtsChapterAudio, TtsVoiceCatalog } from '@/types/tts'

export async function getTtsVoices(gender: 'all' | 'female' | 'male' = 'all') {
  if (!hasConfiguredApi()) {
    throw new ApiRequestError('当前为演示模式，暂时无法获取音色。', 0)
  }
  return requestJson<TtsVoiceCatalog>(`/api/tts/voices?gender=${encodeURIComponent(gender)}`, {
    token: getAuthToken(),
    timeout: 10000,
    showLoading: false,
    forbiddenMessage: '当前内容暂不可用。',
    onUnauthorized: clearAuthSession
  })
}

export async function getChapterTts(
  chapterUrl: string,
  absoluteOffset: number,
  bookTitle: string,
  maxCharacters: number,
  rate: number,
  voice: string,
  cancellation?: RequestCancellation
) {
  if (!hasConfiguredApi()) {
    throw new ApiRequestError('当前为演示模式，暂时无法使用听书。', 0)
  }
  return requestJson<TtsChapterAudio>('/api/tts/chapter', {
    method: 'POST',
    data: {
      chapterUrl,
      absoluteOffset,
      maxCharacters,
      bookTitle,
      rate,
      voice
    },
    token: getAuthToken(),
    timeout: 310000,
    showLoading: false,
    cancellation,
    forbiddenMessage: '当前内容暂不可用。',
    onUnauthorized: clearAuthSession
  })
}
