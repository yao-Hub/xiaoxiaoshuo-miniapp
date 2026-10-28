import { watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/useTheme'
import { syncTabBar } from '@/utils/tabbar'

export function useTabBarTheme(selectedIndex: number) {
  const theme = usePageTheme()

  function syncCurrentTabBar() {
    syncTabBar(selectedIndex, theme.resolvedTheme.value)
  }

  onShow(syncCurrentTabBar)
  watch(theme.resolvedTheme, syncCurrentTabBar)

  return theme
}
