const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export function hasConfiguredApi() {
  return Boolean(API_BASE)
}

interface ApiEnvelope<T> {
  code: number
  msg: string
  data: T
}

interface ApiErrorBody {
  error?: string
  msg?: string
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  token?: string
  timeout?: number
  forbiddenMessage?: string
  onUnauthorized?: () => void
}

export function requestJson<T>(path: string, options: RequestOptions = {}) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      timeout: options.timeout || 30000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const body = response.data as T | ApiEnvelope<T>
          resolve(
            body && typeof body === 'object' && 'code' in body && 'msg' in body && 'data' in body
              ? (body as ApiEnvelope<T>).data
              : (body as T)
          )
          return
        }

        const body = response.data as ApiErrorBody | undefined
        const message =
          response.statusCode === 403 && options.forbiddenMessage
            ? options.forbiddenMessage
            : body?.msg || body?.error || `请求失败：${response.statusCode}`
        if (response.statusCode === 401) {
          options.onUnauthorized?.()
        }
        reject(new ApiRequestError(message, response.statusCode))
      },
      fail(error) {
        reject(new ApiRequestError(error.errMsg || '网络请求失败', 0))
      }
    })
  })
}
