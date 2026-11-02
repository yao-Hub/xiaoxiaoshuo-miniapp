import { clearAuthSession, getAuthToken } from '@/services/auth'
import {
  ApiRequestError,
  hasConfiguredApi,
  requestJson,
  type RequestCancellation
} from '@/services/http'
import type { TtsChapterAudio } from '@/types/tts'

export async function getChapterTts(
  chapterUrl: string,
  absoluteOffset: number,
  bookTitle: string,
  maxCharacters: number,
  rate: number,
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
      ...(rate === 1 ? {} : { rate })
    },
    token: getAuthToken(),
    timeout: 310000,
    showLoading: false,
    cancellation,
    forbiddenMessage: '当前内容暂不可用。',
    onUnauthorized: clearAuthSession
  })
}
