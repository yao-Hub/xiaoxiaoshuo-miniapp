import { ref } from 'vue'
import { loadChapterWithCache } from '@/services/chapter-cache'
import type { ChapterContent } from '@/types/novel'

export function useReaderChapter() {
  const chapterUrl = ref('')
  const requestedChapterUrl = ref('')
  const catalogUrl = ref('')
  const bookTitle = ref('')
  const chapter = ref<ChapterContent>()
  const loading = ref(true)
  const errorMessage = ref('')
  let activeRequestId = 0

  async function loadChapter(targetUrl: string): Promise<ChapterContent | undefined> {
    const normalizedTargetUrl = targetUrl.trim()
    requestedChapterUrl.value = normalizedTargetUrl
    if (!normalizedTargetUrl) {
      loading.value = false
      errorMessage.value = '缺少章节地址'
      return undefined
    }

    const requestId = ++activeRequestId
    loading.value = true
    errorMessage.value = ''
    try {
      const nextChapter = await loadChapterWithCache(normalizedTargetUrl)
      if (requestId !== activeRequestId) {
        return undefined
      }
      chapter.value = nextChapter
      chapterUrl.value = nextChapter.chapterUrl
      requestedChapterUrl.value = nextChapter.chapterUrl
      catalogUrl.value = nextChapter.catalogUrl || catalogUrl.value
      return nextChapter
    } catch (error) {
      if (requestId !== activeRequestId) {
        return undefined
      }
      const message = error instanceof Error ? error.message.trim() : ''
      errorMessage.value = message || '请求失败，请检查网络后重试'
      return undefined
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
      }
    }
  }

  function cancelPendingLoad() {
    activeRequestId += 1
    loading.value = false
  }

  return {
    chapterUrl,
    requestedChapterUrl,
    catalogUrl,
    bookTitle,
    chapter,
    loading,
    errorMessage,
    loadChapter,
    cancelPendingLoad
  }
}
