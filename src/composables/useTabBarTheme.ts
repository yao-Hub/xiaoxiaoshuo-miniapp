import { watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAudiobook } from '@/composables/useAudiobook'
import { usePageTheme } from '@/composables/useTheme'
import { setTabBarHidden, syncTabBar } from '@/utils/tabbar'

export function useTabBarTheme(selectedIndex: number) {
  const theme = usePageTheme()
  const audiobook = useAudiobook()

  function syncCurrentTabBar() {
    syncTabBar(selectedIndex, theme.resolvedTheme.value)
    setTabBarHidden(audiobook.settingsVisible.value)
  }

  onShow(syncCurrentTabBar)
  watch(theme.resolvedTheme, syncCurrentTabBar)

  return theme
}
