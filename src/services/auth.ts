const TOKEN_KEY = 'xiaoxiaoshuo.authToken'
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
export const CONTENT_UNAVAILABLE_MESSAGE = '内容暂不可用'

export interface SessionUser {
  id: number
  username: string
  accessEnabled: boolean
  accessExpiresAt: string | null
  remark: string
  createdAt: string
  lastLoginAt: string | null
}

interface AuthResponse {
  token: string
  user: SessionUser
}

async function authRequest<T>(path: string, data?: Record<string, string>) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}`,
      method: data ? 'POST' : 'GET',
      data,
      header: {
        'content-type': 'application/json',
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
      },
      timeout: 20000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        const body = response.data as { error?: string } | undefined
        reject(new Error(body?.error || `请求失败：${response.statusCode}`))
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'))
      }
    })
  })
}

export function getAuthToken() {
  return String(uni.getStorageSync(TOKEN_KEY) || '')
}

export function setAuthSession(result: AuthResponse) {
  uni.setStorageSync(TOKEN_KEY, result.token)
  uni.setStorageSync('xiaoxiaoshuo.currentUser', result.user)
}

export function getCachedUser(): SessionUser | undefined {
  const value = uni.getStorageSync('xiaoxiaoshuo.currentUser')
  return value && typeof value === 'object' ? value as SessionUser : undefined
}

export function clearAuthSession() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync('xiaoxiaoshuo.currentUser')
}

export function requireLogin(redirectUrl = '') {
  if (getAuthToken()) {
    return true
  }
  const query = redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''
  uni.navigateTo({ url: `/pages/login/login${query}` })
  return false
}

export function openLoginPage(redirectUrl = '') {
  const query = redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''
  uni.navigateTo({ url: `/pages/login/login${query}` })
}

export function openProtectedPage(url: string) {
  if (!getAuthToken()) {
    uni.showModal({
      title: '请先登录',
      content: '查看目录和正文需要先登录账号。',
      confirmText: '去登录',
      cancelText: '取消',
      success(result) {
        if (result.confirm) {
          openLoginPage(url)
        }
      }
    })
    return
  }

  const user = getCachedUser()
  if (user && !hasActiveAccess(user)) {
    uni.showToast({ title: CONTENT_UNAVAILABLE_MESSAGE, icon: 'none' })
    return
  }

  uni.navigateTo({ url })
}

export async function login(username: string, password: string) {
  const result = await authRequest<AuthResponse>('/api/auth/login', { username, password })
  setAuthSession(result)
  return result.user
}

export async function register(username: string, password: string) {
  const result = await authRequest<AuthResponse>('/api/auth/register', { username, password })
  setAuthSession(result)
  return result.user
}

export async function getCurrentUser() {
  const result = await authRequest<{ user: SessionUser }>('/api/auth/me')
  uni.setStorageSync('xiaoxiaoshuo.currentUser', result.user)
  return result.user
}

export function logout() {
  clearAuthSession()
  uni.reLaunch({ url: '/pages/login/login' })
}

export function hasActiveAccess(user: SessionUser | undefined) {
  if (!user?.accessEnabled) {
    return false
  }
  return !user.accessExpiresAt || Date.parse(user.accessExpiresAt) > Date.now()
}
