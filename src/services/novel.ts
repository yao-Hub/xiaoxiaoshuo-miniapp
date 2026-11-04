import type {
  ApiCatalogResponse,
  ApiChapterResponse,
  ApiSearchResponse,
  Book,
  Catalog,
  ChapterContent
} from '@/types/novel'
import { clearAuthSession, getAuthToken } from '@/services/auth'
import { CONTENT_UNAVAILABLE_MESSAGE } from '@/constants/messages'
import { hasConfiguredApi, requestJson } from '@/services/http'
import { normalizeTitle, relevanceScore } from '@/utils/search'

const DEMO_CHAPTER_COUNT = 36

const demoBooks: Book[] = [
  createDemoBook('perfect-world', '完美世界', '辰东', '一粒尘可填海，一根草斩尽日月星辰。'),
  createDemoBook('coiling-dragon', '盘龙', '我吃西红柿', '大小的血睛鬃毛狮，毁天灭地的九头蛇。'),
  createDemoBook('breaking-sky', '斗破苍穹', '天蚕土豆', '这里是属于斗气的世界。'),
  createDemoBook('perfect-world-light', '完美世界之光明仙帝', '星海游吟', '少年徐钰进入逐鹿书院。'),
  createDemoBook('from-perfect-world', '从完美世界开始', '心意难平', '带着系统穿越到完美世界。')
]

function createDemoBook(id: string, title: string, author: string, intro: string): Book {
  return {
    id,
    title,
    author,
    intro,
    source: 'demo',
    sourceLabel: '演示站点',
    coverUrl: '',
    catalogUrl: `mock://${id}`,
    readUrl: `mock://${id}/1`
  }
}

function delay(milliseconds = 220) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function request<T>(
  path: string,
  data?: Record<string, string | number>,
  forbiddenMessage?: string
) {
  return requestJson<T>(path, {
    data,
    token: getAuthToken(),
    timeout: 30000,
    showLoading: false,
    forbiddenMessage,
    onUnauthorized: clearAuthSession
  })
}

export async function searchBooks(
  query: string,
  page = 1,
  pageSize = 20
): Promise<ApiSearchResponse> {
  const value = query.trim()
  if (!value) {
    return {
      items: [],
      page,
      pageSize,
      hasMore: false
    }
  }

  if (!hasConfiguredApi()) {
    await delay()
    const normalizedQuery = normalizeTitle(value)
    const items = demoBooks
      .filter((book) => normalizeTitle(`${book.title}${book.author}`).includes(normalizedQuery))
      .sort((left, right) => relevanceScore(right.title, value) - relevanceScore(left.title, value))
    const start = (page - 1) * pageSize
    return {
      items: items.slice(start, start + pageSize),
      page,
      pageSize,
      hasMore: start + pageSize < items.length
    }
  }

  return request<ApiSearchResponse>('/api/search', { q: value, page, pageSize })
}

export async function getCatalog(catalogUrl: string): Promise<Catalog> {
  if (!hasConfiguredApi() || catalogUrl.startsWith('mock://')) {
    await delay(160)
    const demoId = catalogUrl.replace(/^mock:\/\//, '').split('/')[0]
    const book = demoBooks.find((item) => item.id === demoId) || demoBooks[0]
    return {
      book,
      chapters: Array.from({ length: DEMO_CHAPTER_COUNT }, (_, index) => {
        const id = index + 1
        return {
          id,
          title: `第${id}章 ${id === 1 ? '故事开始' : `新的篇章 ${id}`}`,
          url: `mock://${book.id}/${id}`
        }
      })
    }
  }

  const response = await request<ApiCatalogResponse>(
    '/api/catalog',
    { url: catalogUrl },
    CONTENT_UNAVAILABLE_MESSAGE
  )
  return {
    book: response.book,
    chapters: response.chapters || []
  }
}

export async function getChapter(chapterUrl: string): Promise<ChapterContent> {
  if (!hasConfiguredApi() || chapterUrl.startsWith('mock://')) {
    await delay(140)
    const match = chapterUrl.match(/^mock:\/\/([^/]+)\/(\d+)$/)
    const demoId = match?.[1] || demoBooks[0].id
    const id = Number(match?.[2] || 1)
    const catalog = await getCatalog(`mock://${demoId}`)
    const selected = catalog.chapters.find((item) => item.id === id) || catalog.chapters[0]
    const paragraphs = [
      '夜色从山脊缓慢落下，远处的灯火像散在纸上的金色墨点。',
      '少年合上手中的旧书，听见风穿过长廊，也听见更远处隐约传来的钟声。',
      '他知道，真正漫长的旅程还没有开始。那些尚未写下的故事，正在云层之后等待。',
      '当第一缕晨光越过城墙，所有沉默的道路都同时有了方向。',
      '这是本地演示正文。启动 Node.js 后端后，会自动切换为真实章节内容。'
    ]
    return {
      id: selected.id,
      title: selected.title,
      content: paragraphs.join('\n\n'),
      source: 'demo',
      sourceLabel: '演示站点',
      chapterUrl: selected.url,
      catalogUrl: catalog.book.catalogUrl,
      prevUrl: selected.id > 1 ? `mock://${demoId}/${selected.id - 1}` : '',
      nextUrl: selected.id < DEMO_CHAPTER_COUNT ? `mock://${demoId}/${selected.id + 1}` : ''
    }
  }

  const response = await request<ApiChapterResponse>(
    '/api/chapter',
    { url: chapterUrl },
    CONTENT_UNAVAILABLE_MESSAGE
  )
  return response
}
