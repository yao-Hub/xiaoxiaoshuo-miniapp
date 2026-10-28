import { CONTENT_UNAVAILABLE_MESSAGE } from '@/constants/messages'
import { requestJson } from '@/services/http'

export { CONTENT_UNAVAILABLE_MESSAGE } from '@/constants/messages'

const TOKEN_KEY = 'xiaoxiaoshuo.authToken'

export interface SessionUser {
  id: string
  publicId: string
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

export function getAuthToken() {
  return String(uni.getStorageSync(TOKEN_KEY) || '')
}

export function setAuthSession(result: AuthResponse) {
  uni.setStorageSync(TOKEN_KEY, result.token)
  uni.setStorageSync('xiaoxiaoshuo.currentUser', result.user)
}

export function getCachedUser(): SessionUser | undefined {
  const value = uni.getStorageSync('xiaoxiaoshuo.currentUser')
  return value && typeof value === 'object' ? (value as SessionUser) : undefined
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

export async function openProtectedPage(url: string) {
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
  if (user && hasActiveAccess(user)) {
    uni.navigateTo({ url })
    return
  }

  try {
    const currentUser = await getCurrentUser()
    if (!hasActiveAccess(currentUser)) {
      uni.showToast({ title: CONTENT_UNAVAILABLE_MESSAGE, icon: 'none' })
      return
    }
    uni.navigateTo({ url })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : CONTENT_UNAVAILABLE_MESSAGE,
      icon: 'none'
    })
  }
}

export async function login(username: string, password: string) {
  const result = await requestJson<AuthResponse>('/api/auth/login', {
    method: 'POST',
    data: { username, password },
    timeout: 20000
  })
  setAuthSession(result)
  return result.user
}

export async function register(username: string, password: string) {
  const result = await requestJson<AuthResponse>('/api/auth/register', {
    method: 'POST',
    data: { username, password },
    timeout: 20000
  })
  setAuthSession(result)
  return result.user
}

export async function getCurrentUser() {
  const result = await requestJson<{ user: SessionUser }>('/api/auth/me', {
    token: getAuthToken(),
    timeout: 20000,
    onUnauthorized: clearAuthSession
  })
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
