export interface Book {
  id: string
  title: string
  author: string
  intro: string
  source: string
  sourceLabel: string
  coverUrl: string
  catalogUrl: string
  readUrl: string
}

export type SearchMode = 'app' | 'web'

export interface Chapter {
  id: number
  title: string
  url: string
}

export interface Catalog {
  book: Book
  chapters: Chapter[]
}

export interface ChapterContent {
  id: number
  title: string
  content: string
  source: string
  sourceLabel: string
  chapterUrl: string
  catalogUrl: string
  prevUrl: string
  nextUrl: string
}

export interface ReadingHistoryItem {
  key: string
  bookTitle: string
  chapterTitle: string
  chapterUrl: string
  catalogUrl: string
  coverUrl?: string
  scrollTop?: number
  progress?: number
  pageIndex?: number
  updatedAt: number
}

export interface SearchGroup {
  source: string
  label: string
  count: number
  error: string
  items: Book[]
}

export interface ApiSearchGroup {
  source: string
  label: string
  count: number
  error: string
}

export interface ApiSearchResponse {
  items: Book[]
  groups: ApiSearchGroup[]
}

export interface ApiCatalogResponse {
  book: Book
  chapters: Chapter[]
}

export interface ApiChapterResponse {
  id: number
  title: string
  content: string
  source: string
  sourceLabel: string
  chapterUrl: string
  catalogUrl: string
  prevUrl: string
  nextUrl: string
}
