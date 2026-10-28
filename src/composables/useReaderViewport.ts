import { computed, ref } from 'vue'

export function useReaderViewport() {
  const systemInfo = uni.getSystemInfoSync()
  const topInset = ref(Math.max(0, systemInfo.statusBarHeight || 0))
  const contentTopInset = ref(topInset.value + uni.upx2px(44))
  const rightInset = ref(16)

  try {
    const menuButton = uni.getMenuButtonBoundingClientRect?.()
    if (menuButton) {
      rightInset.value = Math.max(16, systemInfo.windowWidth - menuButton.left + 8)
      contentTopInset.value = Math.max(contentTopInset.value, menuButton.bottom + uni.upx2px(8))
    }
  } catch {
    // Keep default spacing when the capsule position is unavailable.
  }

  const viewportHeight = Math.max(320, systemInfo.windowHeight || systemInfo.screenHeight || 320)
  const windowWidth = Math.max(320, systemInfo.windowWidth || 320)
  const readerPageHeight = Math.max(viewportHeight, systemInfo.screenHeight || viewportHeight)
  const pageViewportHeight = computed(() => Math.max(260, viewportHeight - contentTopInset.value))
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
