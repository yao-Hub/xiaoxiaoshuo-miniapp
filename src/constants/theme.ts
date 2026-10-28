import type { ResolvedTheme, ThemeMode, ThemePalette } from '@/types/theme'

export const THEME_STORAGE_KEY = 'xiaoxiaoshuo.themeMode'

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark']

export const THEME_PALETTES: Record<ResolvedTheme, ThemePalette> = {
  light: {
    background: '#f6f1e7',
    foreground: 'black'
  },
  dark: {
    background: '#12110f',
    foreground: 'white'
  }
}
