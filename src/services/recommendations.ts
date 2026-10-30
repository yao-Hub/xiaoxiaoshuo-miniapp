import { getAuthToken } from '@/services/auth'
import { requestJson } from '@/services/http'

export interface RecommendationCategories {
  searches: string[]
  books: string[]
}

export function getRecommendationCategories() {
  return requestJson<RecommendationCategories>('/api/recommendations', {
    token: getAuthToken(),
    timeout: 10000,
    showLoading: false
  })
}
