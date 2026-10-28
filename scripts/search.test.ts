import { describe, expect, it } from 'vitest'
import { normalizeTitle, relevanceScore } from '../src/utils/search'

describe('search ranking', () => {
  it('normalizes case, spaces and punctuation', () => {
    expect(normalizeTitle(' 《完美 世界》 ')).toBe('完美世界')
  })

  it('ranks exact, prefix, contains and missing matches in order', () => {
    const query = '完美世界'
    const exact = relevanceScore('完美世界', query)
    const prefix = relevanceScore('完美世界之光明仙帝', query)
    const contains = relevanceScore('从完美世界开始', query)
    const unrelated = relevanceScore('盘龙', query)

    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(contains)
    expect(contains).toBeGreaterThan(unrelated)
  })

  it('returns zero for unrelated content', () => {
    expect(relevanceScore('斗破苍穹', '完美世界')).toBe(0)
  })
})
