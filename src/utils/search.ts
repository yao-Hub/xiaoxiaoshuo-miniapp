export function normalizeTitle(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

export function relevanceScore(title: string, query: string) {
  const normalizedTitle = normalizeTitle(title)
  const normalizedQuery = normalizeTitle(query)

  if (normalizedTitle === normalizedQuery) {
    return 1000
  }
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 800 - Math.abs(normalizedTitle.length - normalizedQuery.length)
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    return 600 - Math.abs(normalizedTitle.length - normalizedQuery.length)
  }
  return 0
}
