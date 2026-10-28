import { getChapter } from '@/services/novel'
import type { ChapterContent } from '@/types/novel'

const MAX_CACHED_CHAPTERS = 8
const cache = new Map<string, ChapterContent>()
const aliases = new Map<string, string>()
const pending = new Map<string, Promise<ChapterContent>>()

function resolveCacheKey(url: string) {
  return aliases.get(url) || url
}

function removeAliases(cacheKey: string) {
  aliases.forEach((canonicalKey, alias) => {
    if (canonicalKey === cacheKey) {
      aliases.delete(alias)
    }
  })
}

function remember(requestUrl: string, chapter: ChapterContent) {
  const cacheKey = chapter.chapterUrl || requestUrl
  aliases.set(requestUrl, cacheKey)
  aliases.set(cacheKey, cacheKey)
  cache.delete(cacheKey)
  cache.set(cacheKey, chapter)
  while (cache.size > MAX_CACHED_CHAPTERS) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
    removeAliases(oldestKey)
  }
}

function getCachedChapter(url: string) {
  const cacheKey = resolveCacheKey(url)
  const cached = cache.get(cacheKey)
  if (!cached) {
    return undefined
  }
  cache.delete(cacheKey)
  cache.set(cacheKey, cached)
  aliases.set(url, cacheKey)
  return cached
}

export function loadChapterWithCache(url: string) {
  const cached = getCachedChapter(url)
  if (cached) {
    return Promise.resolve(cached)
  }

  const existingRequest = pending.get(url)
  if (existingRequest) {
    return existingRequest
  }

  const request = getChapter(url)
    .then((chapter) => {
      remember(url, chapter)
      return chapter
    })
    .finally(() => {
      pending.delete(url)
    })
  pending.set(url, request)
  return request
}
