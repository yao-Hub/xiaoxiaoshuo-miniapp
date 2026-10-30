import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import {
  trackAnalyticsDuration,
  trackAnalyticsEvent,
  type AnalyticsEventType
} from '@/services/analytics'

interface PageAnalyticsOptions {
  sessionEventType?: Extract<AnalyticsEventType, 'page_session' | 'reader_session'>
  getContext?: () => {
    bookTitle?: string
    chapterUrl?: string
  }
}

export function usePageAnalytics(
  page: string,
  optionsInput: PageAnalyticsOptions | 'page_session' | 'reader_session' = {}
) {
  const options: PageAnalyticsOptions =
    typeof optionsInput === 'string' ? { sessionEventType: optionsInput } : optionsInput
  let sessionStartedAt = 0

  const finishSession = () => {
    if (!sessionStartedAt) {
      return
    }
    const context = options.getContext?.()
    trackAnalyticsDuration(options.sessionEventType || 'page_session', sessionStartedAt, {
      page,
      bookTitle: context?.bookTitle,
      chapterUrl: context?.chapterUrl
    })
    sessionStartedAt = 0
  }

  onShow(() => {
    sessionStartedAt = Date.now()
    trackAnalyticsEvent('page_view', { page })
  })
  onHide(finishSession)
  onUnload(finishSession)
}
