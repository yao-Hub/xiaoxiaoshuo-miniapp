import type { ReaderPageModeOption, ReaderSettings } from '@/types/reader'
import type { ResolvedTheme } from '@/types/theme'

export const READER_SETTINGS_KEY = 'xiaoxiaoshuo.readerSettings'

export const DEFAULT_READER_SETTINGS: Readonly<ReaderSettings> = {
  fontSize: 17,
  brightness: 100,
  pageMode: 'horizontal'
}

export const READER_FONT_SIZE_MIN = 14
export const READER_FONT_SIZE_MAX = 28
export const READER_BRIGHTNESS_MIN = 30

export const READER_SLIDER_COLORS: Record<ResolvedTheme, { active: string; track: string }> = {
  dark: {
    active: '#f5c84c',
    track: 'rgba(245, 237, 220, 0.16)'
  },
  light: {
    active: '#8c5b00',
    track: 'rgba(61, 48, 31, 0.14)'
  }
}

export const READER_PAGE_MODES: readonly ReaderPageModeOption[] = [
  {
    value: 'vertical',
    label: '上下'
  },
  {
    value: 'horizontal',
    label: '左右'
  },
  {
    value: 'scroll',
    label: '滚屏'
  }
]
