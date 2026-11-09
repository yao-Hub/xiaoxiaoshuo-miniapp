import { CONTENT_UNAVAILABLE_MESSAGE } from '@/constants/messages'
import { ApiRequestError, requestJson } from '@/services/http'

const TOKEN_KEY = 'xiaoxiaoshuo.authToken'

export type UserPermissionKey = 'catalog_content' | 'audiobook'

export interface UserPermission {
  key: UserPermissionKey
  name: string
  enabled: boolean
  expiresAt: string | null
  trialMinutes: number
}

export interface SessionUser {
  id: string
  publicId: string
  username: string
  displayName: string
  avatarUrl: string | null
  accountEnabled: boolean
  accessEnabled: boolean
  accessExpiresAt: string | null
  accessTrialMinutes: number
  audiobookEnabled: boolean
  audiobookExpiresAt: string | null
  audiobookTrialMinutes: number
  createdAt: string
  lastLoginAt: string | null
  permissions?: UserPermission[]
}

interface AuthResponse {
  token: string
  user: SessionUser
  permissions?: UserPermission[]
}

interface WechatAuthResponse extends AuthResponse {
  isNewUser: boolean
}

interface UserProfileResponse {
  user: SessionUser
  permissions: UserPermission[]
}

let wechatLoginPromise: Promise<SessionUser> | undefined
let sessionPromise: Promise<SessionUser> | undefined
let validatedToken = ''

export function getAuthToken() {
  return String(uni.getStorageSync(TOKEN_KEY) || '')
}

export function setAuthSession(result: AuthResponse) {
  uni.setStorageSync(TOKEN_KEY, result.token)
  uni.setStorageSync('xiaoxiaoshuo.currentUser', {
    ...result.user,
    ...(result.permissions ? { permissions: result.permissions } : {})
  })
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

  if (sessionPromise) {
    try {
      await sessionPromise
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : CONTENT_UNAVAILABLE_MESSAGE,
        icon: 'none'
      })
      return
    }
  }

  const cachedUser = getCachedUser()
  if (cachedUser) {
    if (hasActiveAccess(cachedUser)) {
      uni.navigateTo({ url })
    } else {
      uni.showToast({ title: CONTENT_UNAVAILABLE_MESSAGE, icon: 'none' })
    }
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

export function ensureUserSession(options: { forceRefresh?: boolean } = {}) {
  const token = getAuthToken()
  if (!token) {
    return ensureWechatLogin()
  }
  if (validatedToken === token && !options.forceRefresh) {
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
  const result = await requestJson<UserProfileResponse>('/api/auth/profile', {
    token: getAuthToken(),
    timeout: 20000,
    showLoading: options.showLoading,
    onUnauthorized: clearAuthSession
  })
  const user = {
    ...result.user,
    permissions: result.permissions
  }
  uni.setStorageSync('xiaoxiaoshuo.currentUser', user)
  return user
}

export async function updateProfile(displayName: string, avatarUrl: string | null) {
  const result = await requestJson<{ user: SessionUser }>('/api/auth/profile', {
    method: 'POST',
    data: { displayName, avatarUrl },
    token: getAuthToken(),
    timeout: 30000,
    showLoading: false,
    onUnauthorized: clearAuthSession
  })
  const permissions = getCachedUser()?.permissions
  const user = {
    ...result.user,
    ...(permissions ? { permissions } : {})
  }
  uni.setStorageSync('xiaoxiaoshuo.currentUser', user)
  return user
}

export function logout() {
  clearAuthSession()
  uni.reLaunch({ url: '/pages/login/login' })
}

export function hasActiveAccess(user: SessionUser | undefined) {
  const permission = user?.permissions?.find((item) => item.key === 'catalog_content')
  if (permission) {
    return (
      permission.enabled &&
      (!permission.expiresAt || Date.parse(permission.expiresAt) > Date.now())
    )
  }
  if (!user?.accessEnabled) {
    return false
  }
  return !user.accessExpiresAt || Date.parse(user.accessExpiresAt) > Date.now()
}

export function hasAudiobookAccess(user: SessionUser | undefined) {
  const permission = user?.permissions?.find((item) => item.key === 'audiobook')
  if (permission) {
    return (
      permission.enabled &&
      (!permission.expiresAt || Date.parse(permission.expiresAt) > Date.now())
    )
  }
  if (!user?.audiobookEnabled) {
    return false
  }
  return !user.audiobookExpiresAt || Date.parse(user.audiobookExpiresAt) > Date.now()
}
