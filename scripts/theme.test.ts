import { describe, expect, it } from 'vitest'
import { normalizeThemeMode, oppositeTheme, resolveTheme } from '../src/utils/theme'

describe('theme utilities', () => {
  it('defaults invalid stored values to system mode', () => {
    expect(normalizeThemeMode(undefined)).toBe('system')
    expect(normalizeThemeMode('unknown')).toBe('system')
  })

  it('keeps supported manual theme modes', () => {
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('dark')).toBe('dark')
  })

  it('resolves system mode from the current system theme', () => {
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('light', 'dark')).toBe('light')
  })

  it('returns the next manual reading theme', () => {
    expect(oppositeTheme('dark')).toBe('light')
    expect(oppositeTheme('light')).toBe('dark')
  })
})
