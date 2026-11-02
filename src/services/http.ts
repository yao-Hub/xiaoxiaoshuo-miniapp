const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export function hasConfiguredApi() {
  return Boolean(API_BASE)
}

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
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

export interface RequestCancellation {
  readonly aborted: boolean
  abort(): void
  subscribe(listener: () => void): () => void
}

export function createRequestCancellation(): RequestCancellation {
  let aborted = false
  const listeners = new Set<() => void>()
  return {
    get aborted() {
      return aborted
    },
    abort() {
      if (aborted) {
        return
      }
      aborted = true
      listeners.forEach((listener) => listener())
      listeners.clear()
    },
    subscribe(listener) {
      if (aborted) {
        listener()
        return () => {}
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
  token?: string
  timeout?: number
  forbiddenMessage?: string
  onUnauthorized?: () => void
  cancellation?: RequestCancellation
  showLoading?: boolean
}

let activeLoadingRequests = 0

function beginRequestLoading() {
  activeLoadingRequests += 1
  if (activeLoadingRequests === 1) {
    uni.showLoading({ title: '加载中', mask: true })
  }
}

function endRequestLoading() {
  activeLoadingRequests -= 1
  if (activeLoadingRequests === 0) {
    uni.hideLoading()
  }
}

export function requestJson<T>(path: string, options: RequestOptions = {}) {
  return new Promise<T>((resolve, reject) => {
    if (options.cancellation?.aborted) {
      reject(new ApiRequestError('请求已取消', 0))
      return
    }

    let settled = false
    let unsubscribe = () => {}
    const usesGlobalLoading = options.showLoading !== false
    if (usesGlobalLoading) {
      beginRequestLoading()
    }

    const cleanup = () => {
      unsubscribe()
      if (usesGlobalLoading) {
        endRequestLoading()
      }
    }
    const resolveOnce = (value: T) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }
    const rejectOnce = (error: ApiRequestError) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }
    const method = options.method || 'GET'
    const requestTask = uni.request({
      url: `${API_BASE}${path}`,
      method,
      data: method === 'POST' ? options.data || {} : options.data,
      header: {
        'content-type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      timeout: options.timeout || 30000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const body = response.data as T | ApiEnvelope<T>
          resolveOnce(
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
        rejectOnce(new ApiRequestError(message, response.statusCode))
      },
      fail(error) {
        rejectOnce(new ApiRequestError(error.errMsg || '网络请求失败', 0))
      }
    })
    const handleAbort = () => {
      requestTask.abort()
      rejectOnce(new ApiRequestError('请求已取消', 0))
    }
    unsubscribe = options.cancellation?.subscribe(handleAbort) || (() => {})
  })
}
