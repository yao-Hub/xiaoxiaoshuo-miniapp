import { computed, ref } from 'vue'

const READER_BOTTOM_ACTION_HEIGHT_RPX = 90

export function useReaderViewport() {
  const systemInfo = uni.getSystemInfoSync()
  const topInset = ref(Math.max(0, systemInfo.statusBarHeight || 0))
  const contentTopInset = ref(topInset.value + uni.upx2px(44))
  const rightInset = ref(16)

  const menuButton = uni.getMenuButtonBoundingClientRect()
  rightInset.value = Math.max(16, systemInfo.windowWidth - menuButton.left + 8)
  contentTopInset.value = Math.max(contentTopInset.value, menuButton.bottom + uni.upx2px(8))

  const viewportHeight = Math.max(320, systemInfo.windowHeight || systemInfo.screenHeight || 320)
  const windowWidth = Math.max(320, systemInfo.windowWidth || 320)
  const readerPageHeight = Math.max(viewportHeight, systemInfo.screenHeight || viewportHeight)
  const bottomActionInset = uni.upx2px(READER_BOTTOM_ACTION_HEIGHT_RPX)
  const pageViewportHeight = computed(() =>
    Math.max(260, viewportHeight - contentTopInset.value - bottomActionInset)
  )
  const pageContentHeight = computed(() => Math.max(160, pageViewportHeight.value - uni.upx2px(12)))
  const textWidthPx = Math.max(120, windowWidth - uni.upx2px(80))

  return {
    topInset,
    contentTopInset,
    rightInset,
    viewportHeight,
    windowWidth,
    readerPageHeight,
    pageViewportHeight,
    pageContentHeight,
    textWidthPx
  }
}
