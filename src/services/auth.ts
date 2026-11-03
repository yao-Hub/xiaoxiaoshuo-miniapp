import { CONTENT_UNAVAILABLE_MESSAGE } from '@/constants/messages'
import { ApiRequestError, requestJson } from '@/services/http'

const TOKEN_KEY = 'xiaoxiaoshuo.authToken'

export interface SessionUser {
  id: string
  publicId: string
  username: string
  accountEnabled: boolean
  accessEnabled: boolean
  accessExpiresAt: string | null
  audiobookEnabled: boolean
  audiobookExpiresAt: string | null
  remark: string
  createdAt: string
  lastLoginAt: string | null
}

interface AuthResponse {
  token: string
  user: SessionUser
}

interface WechatAuthResponse extends AuthResponse {
  isNewUser: boolean
}

let wechatLoginPromise: Promise<SessionUser> | undefined
let sessionPromise: Promise<SessionUser> | undefined
let validatedToken = ''

export function getAuthToken() {
  return String(uni.getStorageSync(TOKEN_KEY) || '')
}

export function setAuthSession(result: AuthResponse) {
  uni.setStorageSync(TOKEN_KEY, result.token)
  uni.setStorageSync('xiaoxiaoshuo.currentUser', result.user)
  validatedToken = result.token
}

export function getCachedUser(): SessionUser | undefined {
  const value = uni.getStorageSync('xiaoxiaoshuo.currentUser')
  return value && typeof value === 'object' ? (value as SessionUser) : undefined
}

export function clearAuthSession() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync('xiaoxiaoshuo.currentUser')
  validatedToken = ''
}

export function openLoginPage(redirectUrl = '') {
  const query = redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''
  uni.navigateTo({ url: `/pages/login/login${query}` })
}

export async function openProtectedPage(
  url: string,
  options: { requireContentAccess?: boolean } = {}
) {
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

  if (options.requireContentAccess === false) {
    uni.navigateTo({ url })
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

function getWechatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success(result) {
        const code = String(result.code || '')
        if (code) {
          resolve(code)
          return
        }
        reject(new Error('微信登录未返回凭证，请重试'))
      },
      fail(error) {
        reject(new Error(error.errMsg || '微信登录失败，请重试'))
      }
    })
  })
}

export async function loginWithWechat() {
  const code = await getWechatLoginCode()
  const result = await requestJson<WechatAuthResponse>('/api/auth/wechat-login', {
    method: 'POST',
    data: { code },
    timeout: 20000,
    showLoading: false
  })
  setAuthSession(result)
  return result.user
}

function ensureWechatLogin() {
  const cachedUser = getCachedUser()
  if (getAuthToken() && cachedUser) {
    return Promise.resolve(cachedUser)
  }
  wechatLoginPromise ||= loginWithWechat().finally(() => {
    wechatLoginPromise = undefined
  })
  return wechatLoginPromise
}

export function ensureUserSession() {
  const token = getAuthToken()
  if (!token) {
    return ensureWechatLogin()
  }
  if (validatedToken === token) {
    return Promise.resolve(getCachedUser()!)
  }

  sessionPromise ||= getCurrentUser({ showLoading: false })
    .catch((error) => {
      if (error instanceof ApiRequestError && error.statusCode === 401) {
        return ensureWechatLogin()
      }
      throw error
    })
    .then((user) => {
      validatedToken = getAuthToken()
      return user
    })
    .finally(() => {
      sessionPromise = undefined
    })
  return sessionPromise
}

export async function getCurrentUser(options: { showLoading?: boolean } = {}) {
  const result = await requestJson<{ user: SessionUser }>('/api/auth/me', {
    token: getAuthToken(),
    timeout: 20000,
    showLoading: options.showLoading,
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

export function hasAudiobookAccess(user: SessionUser | undefined) {
  if (!user?.audiobookEnabled) {
    return false
  }
  return !user.audiobookExpiresAt || Date.parse(user.audiobookExpiresAt) > Date.now()
}
