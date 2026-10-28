import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { THEME_PALETTES, THEME_STORAGE_KEY } from '@/constants/theme'
import type { ResolvedTheme, ThemeMode } from '@/types/theme'
import { normalizeThemeMode, oppositeTheme, resolveTheme } from '@/utils/theme'

function detectSystemTheme(): ResolvedTheme {
  try {
    const systemTheme = uni.getSystemInfoSync().theme
    if (systemTheme === 'light' || systemTheme === 'dark') {
      return systemTheme
    }
  } catch {
    // Keep the app usable when a platform does not expose its system theme.
  }

  return 'dark'
}

const savedMode = normalizeThemeMode(uni.getStorageSync(THEME_STORAGE_KEY))
const themeMode = ref<ThemeMode>(savedMode)
const systemTheme = ref<ResolvedTheme>(detectSystemTheme())
const resolvedTheme = computed(() => resolveTheme(themeMode.value, systemTheme.value))
const themeClass = computed(() => `theme-${resolvedTheme.value}`)
let initialized = false

function applyNativeTheme() {
  const palette = THEME_PALETTES[resolvedTheme.value]
  try {
    uni.setNavigationBarColor({
      frontColor: palette.foreground === 'white' ? '#ffffff' : '#000000',
      backgroundColor: palette.background,
      animation: {
        duration: 0,
        timingFunc: 'linear'
      }
    })
  } catch {
    // Custom-navigation pages may not support native navigation colors.
  }

  try {
    uni.setBackgroundColor({
      backgroundColor: palette.background,
      backgroundColorTop: palette.background,
      backgroundColorBottom: palette.background
    })
  } catch {
    // Background color is an optional native enhancement.
  }
}

function refreshSystemTheme() {
  systemTheme.value = detectSystemTheme()
  if (themeMode.value === 'system') {
    applyNativeTheme()
  }
}

export function initializeTheme() {
  if (initialized) {
    return
  }
  initialized = true
  refreshSystemTheme()

  if (typeof uni.onThemeChange === 'function') {
    uni.onThemeChange(({ theme }) => {
      systemTheme.value = theme
      if (themeMode.value === 'system') {
        applyNativeTheme()
      }
    })
  }
}

function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode
  uni.setStorageSync(THEME_STORAGE_KEY, mode)
  applyNativeTheme()
}

function toggleResolvedTheme() {
  setThemeMode(oppositeTheme(resolvedTheme.value))
}

export function useTheme() {
  initializeTheme()
  return {
    resolvedTheme,
    themeClass,
    toggleResolvedTheme,
    syncNativeTheme: applyNativeTheme
  }
}

export function usePageTheme() {
  const theme = useTheme()
  onShow(() => theme.syncNativeTheme())
  return theme
}
