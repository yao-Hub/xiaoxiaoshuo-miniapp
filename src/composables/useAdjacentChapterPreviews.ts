import { ref } from 'vue'
import { loadChapterWithCache } from '@/services/chapter-cache'
import type { ChapterContent } from '@/types/novel'
import type { ReaderPageData } from '@/types/reader'

export interface ChapterPagePreview {
  chapter: ChapterContent
  page: ReaderPageData
}

export function useAdjacentChapterPreviews(
  buildPagesForChapter: (chapter: ChapterContent) => ReaderPageData[]
) {
  const previousPreviewPage = ref<ChapterPagePreview>()
  const nextPreviewPage = ref<ChapterPagePreview>()
  let generation = 0

  function clear() {
    generation += 1
    previousPreviewPage.value = undefined
    nextPreviewPage.value = undefined
  }

  async function loadPreview(
    url: string,
    type: 'previous' | 'next',
    requestGeneration: number
  ): Promise<ChapterPagePreview | undefined> {
    if (!url) {
      return undefined
    }
    try {
      const chapter = await loadChapterWithCache(url)
      if (requestGeneration !== generation) {
        return undefined
      }
      const pages = buildPagesForChapter(chapter)
      if (!pages.length) {
        return undefined
      }
      return {
        chapter,
        page: type === 'previous' ? pages[pages.length - 1] : pages[0]
      }
    } catch {
      return undefined
    }
  }

  async function prefetch(chapter: ChapterContent) {
    const requestGeneration = ++generation
    previousPreviewPage.value = undefined
    nextPreviewPage.value = undefined
    const [previous, next] = await Promise.all([
      loadPreview(chapter.prevUrl, 'previous', requestGeneration),
      loadPreview(chapter.nextUrl, 'next', requestGeneration)
    ])
    if (requestGeneration !== generation) {
      return
    }
    previousPreviewPage.value = previous
    nextPreviewPage.value = next
  }

  return {
    previousPreviewPage,
    nextPreviewPage,
    clear,
    prefetch
  }
}
