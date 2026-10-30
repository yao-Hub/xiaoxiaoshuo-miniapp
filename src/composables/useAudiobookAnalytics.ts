import { trackAnalyticsDuration, trackAnalyticsEvent } from '@/services/analytics'
import type { TtsChapterAudio } from '@/types/tts'
import type { AudiobookStartOptions } from './useAudiobook'

export function useAudiobookAnalytics() {
  let startedAt = 0

  function startPlayback() {
    if (!startedAt) {
      startedAt = Date.now()
    }
  }

  function finishPlayback(reason: string, context: { bookTitle: string; chapterUrl: string }) {
    if (!startedAt) {
      return
    }
    const sessionStartedAt = startedAt
    startedAt = 0
    trackAnalyticsDuration('audiobook_session', sessionStartedAt, {
      page: 'reader',
      ...context,
      metadata: { reason }
    })
  }

  function trackStart(options: AudiobookStartOptions, result: TtsChapterAudio) {
    trackAnalyticsEvent('audiobook_start', {
      page: 'reader',
      bookTitle: options.bookTitle,
      chapterUrl: options.chapterUrl,
      metadata: {
        chapterTitle: result.chapterTitle,
        startOffset: result.startOffset
      }
    })
  }

  function trackError(options: AudiobookStartOptions, message: string) {
    trackAnalyticsEvent('audiobook_error', {
      page: 'reader',
      bookTitle: options.bookTitle,
      chapterUrl: options.chapterUrl,
      metadata: { message }
    })
  }

  return {
    startPlayback,
    finishPlayback,
    trackStart,
    trackError
  }
}
