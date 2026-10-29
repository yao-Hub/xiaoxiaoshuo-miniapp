import { computed, ref, watch, type Ref } from 'vue'
import { getCatalog } from '@/services/novel'
import type { Chapter } from '@/types/novel'
import { calculateBookChapterProgress, clampReadingPosition } from '@/utils/reading-progress'

interface ReaderCatalogOptions {
  catalogUrl: Ref<string>
  currentChapterUrl: Ref<string>
  bookTitle: Ref<string>
}

export function useReaderCatalog(options: ReaderCatalogOptions) {
  const chapters = ref<Chapter[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const visible = ref(false)
  const dragPreviewIndex = ref<number>()
  let activeRequestId = 0

  watch(
    options.catalogUrl,
    () => {
      activeRequestId += 1
      chapters.value = []
      errorMessage.value = ''
      loading.value = false
      dragPreviewIndex.value = undefined
    },
    { flush: 'sync' }
  )

  const currentChapterIndex = computed(() =>
    chapters.value.findIndex((chapter) => chapter.url === options.currentChapterUrl.value)
  )
  const sliderValue = computed(() => Math.max(0, currentChapterIndex.value))
  const sliderMax = computed(() => Math.max(0, chapters.value.length - 1))
  const previewIndex = computed(() => dragPreviewIndex.value ?? sliderValue.value)
  const previewProgress = computed(() =>
    calculateBookChapterProgress(previewIndex.value, chapters.value.length)
  )
  const previewChapterTitle = computed(() => chapters.value[previewIndex.value]?.title || '')
  const sliderPlaceholder = computed(() => {
    if (loading.value) {
      return '正在加载目录…'
    }
    if (!chapters.value.length) {
      return errorMessage.value ? '目录加载失败' : '正在准备目录…'
    }
    return '未能定位当前章节'
  })

  async function ensureCatalog(force = false) {
    const currentUrl = options.catalogUrl.value
    if (!currentUrl || loading.value) {
      return
    }
    if (!force && chapters.value.length) {
      return
    }

    const requestId = ++activeRequestId
    loading.value = true
    errorMessage.value = ''
    try {
      const catalog = await getCatalog(currentUrl)
      if (requestId !== activeRequestId || options.catalogUrl.value !== currentUrl) {
        return
      }
      chapters.value = catalog.chapters
      options.bookTitle.value = catalog.book.title || options.bookTitle.value
    } catch (error) {
      if (requestId !== activeRequestId || options.catalogUrl.value !== currentUrl) {
        return
      }
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
      }
    }
  }

  function openCatalog() {
    if (!options.catalogUrl.value) {
      uni.showToast({ title: '当前章节没有目录地址', icon: 'none' })
      return
    }
    visible.value = true
    void ensureCatalog()
  }

  function closeCatalog() {
    visible.value = false
    dragPreviewIndex.value = undefined
  }

  function retryCatalog() {
    void ensureCatalog(true)
  }

  function previewChapter(index: number) {
    if (!chapters.value.length) {
      return
    }
    dragPreviewIndex.value = Math.round(clampReadingPosition(index, sliderMax.value))
  }

  function resolveChapterAt(index: number) {
    dragPreviewIndex.value = undefined
    return chapters.value[Math.round(index)]
  }

  function clearChapterPreview() {
    dragPreviewIndex.value = undefined
  }

  return {
    chapters,
    loading,
    errorMessage,
    visible,
    dragPreviewIndex,
    currentChapterIndex,
    sliderValue,
    sliderMax,
    previewProgress,
    previewChapterTitle,
    sliderPlaceholder,
    ensureCatalog,
    openCatalog,
    closeCatalog,
    retryCatalog,
    previewChapter,
    clearChapterPreview,
    resolveChapterAt
  }
}
