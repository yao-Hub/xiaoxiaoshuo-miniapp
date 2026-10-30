import { getAuthToken } from '@/services/auth'
import { hasConfiguredApi, requestJson } from '@/services/http'

const ANALYTICS_SESSION_KEY = 'xiaoxiaoshuo.analyticsSessionId'

export type AnalyticsEventType =
  | 'app_session'
  | 'page_view'
  | 'page_session'
  | 'reader_session'
  | 'audiobook_session'
  | 'search'
  | 'reader_open'
  | 'book_open'
  | 'chapter_change'
  | 'audiobook_start'
  | 'audiobook_error'

interface AnalyticsEventInput {
  page?: string
  bookTitle?: string
  chapterUrl?: string
  durationMs?: number
  value?: number
  metadata?: Record<string, unknown>
}

let memorySessionId = ''

export function getAnalyticsSessionId() {
  if (memorySessionId) {
    return memorySessionId
  }
  const stored = String(uni.getStorageSync(ANALYTICS_SESSION_KEY) || '')
  if (stored) {
    memorySessionId = stored
    return stored
  }
  memorySessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  uni.setStorageSync(ANALYTICS_SESSION_KEY, memorySessionId)
  return memorySessionId
}

export function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  input: AnalyticsEventInput = {}
) {
  const token = getAuthToken()
  if (!token || !hasConfiguredApi()) {
    return
  }
  void requestJson<{ accepted: boolean }>('/api/analytics/events', {
    method: 'POST',
    data: {
      eventType,
      sessionId: getAnalyticsSessionId(),
      page: input.page || '',
      bookTitle: input.bookTitle || '',
      chapterUrl: input.chapterUrl || '',
      durationMs: Math.max(0, Math.round(input.durationMs || 0)),
      value: input.value || 0,
      metadata: input.metadata || {}
    },
    token,
    timeout: 5000,
    showLoading: false
  }).catch(() => {
    // Analytics failures must not interrupt reading.
  })
}

export function trackAnalyticsDuration(
  eventType: AnalyticsEventType,
  startedAt: number,
  input: AnalyticsEventInput = {}
) {
  const durationMs = Math.max(0, Date.now() - startedAt)
  if (durationMs < 1000) {
    return
  }
  trackAnalyticsEvent(eventType, { ...input, durationMs })
}
