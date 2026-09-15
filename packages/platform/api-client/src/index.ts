import {
  createRequest,
  FetchError,
  type FetchAdapter,
  type FetchAdapterInit,
  type FetchRequestConfig,
} from '@soybeanjs/fetch'
import { createTypedClient, toFlatTypedClient } from '@soybeanjs/fetch/openapi'

import { csrfCookieName, csrfHeaderName, refreshTokenCookiePath } from '@jingwei/auth/shared'
import { apiErrorSchema } from '@jingwei/http-contract'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
const globalLoadingListeners = new Set<(loading: boolean) => void>()
const sessionExpiredListeners = new Set<() => void>()
let globalLoading = false
let refreshPromise: Promise<boolean> | null = null
let sessionExpiryNotified = false

const cookieAuthenticationAdapter: FetchAdapter = async (url, init) => {
  const response = await globalThis.fetch(url, init)
  if (!shouldAttemptRefresh(url, init, response)) return response

  const refreshed = await refreshCookieSession()
  if (!refreshed) {
    if (response.status === 401) notifySessionExpired(url)
    return response
  }
  await discardResponseBody(response)
  return globalThis.fetch(url, init)
}

const request = createRequest<unknown, unknown>(
  {
    credentials: 'include',
    adapter: cookieAuthenticationAdapter,
    requestCache: 'no-store',
    retry: { retries: 0 },
    timeout: 30_000,
    onGlobalLoadingChange(loading) {
      globalLoading = loading
      globalLoadingListeners.forEach((listener) => {
        try {
          listener(loading)
        } catch {
          // State observers must never alter the outcome of an HTTP request.
        }
      })
    },
    onRequest(context) {
      context.options.headers.set('accept', 'application/json')

      const method = context.options.method.toUpperCase()
      if (safeMethods.has(method) || context.options.headers.has(csrfHeaderName)) return
      const token = readCookie(csrfCookieName)
      if (token !== null) context.options.headers.set(csrfHeaderName, token)
    },
  },
  {
    // Jingwei uses HTTP status codes rather than a second business-code envelope.
    isBackendSuccess: () => true,
  },
)

/** Stable client-side representation of transport, protocol, and API failures. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly status: number | null,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ApiClientError'
  }
}

/** Per-operation lifecycle callbacks supported by the shared request state adapters. */
export type ApiRequestOptions = Pick<
  FetchRequestConfig,
  'onLoadingChange' | 'onSlowRequest' | 'slowThreshold'
>

/** Never-throwing application-facing result. */
export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiClientError }

type SoybeanFlatResult = { data: unknown; error: null } | { data: null; error: Error }

type SoybeanFlatSuccessData<Result extends SoybeanFlatResult> = Extract<
  Result,
  { error: null }
>['data']

/**
 * Creates a module-scoped OpenAPI client over the single platform request instance.
 *
 * `client` is the preferred never-throwing client. `throwingClient` is an explicit escape hatch for
 * bootstrap and other fail-fast flows. Module clients remain responsible for passing their Zod
 * response schema.
 */
export function createModuleApiClient<Paths extends Record<string, object>, Prefix extends string>(
  prefix: Prefix,
) {
  return {
    client: toFlatTypedClient<Paths, Prefix>(request, prefix),
    throwingClient: createTypedClient<Paths, Prefix>(request, prefix),
  }
}

/**
 * Normalizes a native Soybean Fetch flat result without changing its never-throwing control flow.
 */
export function toApiResult<Result extends SoybeanFlatResult>(
  operation: Promise<Result>,
): Promise<ApiResult<SoybeanFlatSuccessData<Result>>>
export async function toApiResult(
  operation: Promise<SoybeanFlatResult>,
): Promise<ApiResult<unknown>> {
  const result = await operation
  if (result.error !== null) return { data: null, error: toApiClientError(result.error) }
  return { data: result.data, error: null }
}

/** Subscribe to the single request instance's aggregate loading state. */
export function subscribeGlobalApiLoading(listener: (loading: boolean) => void): () => void {
  listener(globalLoading)
  globalLoadingListeners.add(listener)
  return () => globalLoadingListeners.delete(listener)
}

/**
 * Fires once when a protected request remains 401 after cookie refresh fails.
 * Shell chrome owns redirect policy; the client only signals expiry.
 */
export function subscribeSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

/** Allow a later expiry signal after the shell has recovered (e.g. re-login without full reload). */
export function resetSessionExpirySignal(): void {
  sessionExpiryNotified = false
}

function notifySessionExpired(url: string): void {
  const path = requestPath(url)
  if (path === refreshTokenCookiePath) return
  if (path === '/api/v1/iam/sessions') return
  if (path === '/api/v1/iam/session') return
  if (sessionExpiryNotified) return
  sessionExpiryNotified = true
  for (const listener of sessionExpiredListeners) {
    try {
      listener()
    } catch {
      // Shell observers must never alter the outcome of an HTTP request.
    }
  }
}

/**
 * Refreshes the HttpOnly-cookie session without exposing either credential to JavaScript.
 *
 * The readable CSRF cookie is a prerequisite for refresh, so anonymous browsers fail fast without
 * acquiring a cross-tab lock or issuing a redundant session probe. Concurrent calls in one page
 * share a single promise. Browsers that implement Web Locks also serialize refreshes across tabs;
 * after acquiring the lock, a tab first checks whether another tab has already restored the access
 * cookie.
 */
export function refreshCookieSession(): Promise<boolean> {
  if (refreshPromise !== null) return refreshPromise
  if (readCookie(csrfCookieName) === null) return Promise.resolve(false)
  refreshPromise = coordinateCookieRefresh()
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

export async function executeApiRequest<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toApiClientError(error)
  }
}

export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error
  if (!(error instanceof FetchError))
    return new ApiClientError('UNEXPECTED_CLIENT_ERROR', '请求处理失败', null, null, undefined, {
      cause: error,
    })

  const responseRequestId = error.response?.headers.get('x-request-id') ?? null
  if (error.code === 'ERR_BAD_RESPONSE') {
    const parsed = apiErrorSchema.safeParse(error.data)
    if (parsed.success)
      return new ApiClientError(
        parsed.data.code,
        parsed.data.message,
        parsed.data.requestId,
        error.status ?? null,
        parsed.data.details,
        { cause: error },
      )
    return new ApiClientError(
      'UNEXPECTED_API_ERROR',
      '服务器返回了无法识别的错误响应',
      responseRequestId,
      error.status ?? null,
      undefined,
      { cause: error },
    )
  }

  const failure = transportFailure(error.code)
  return new ApiClientError(failure.code, failure.message, responseRequestId, null, undefined, {
    cause: error,
  })
}

function transportFailure(code: string | undefined): { code: string; message: string } {
  switch (code) {
    case 'ERR_TIMEOUT':
      return { code: 'REQUEST_TIMEOUT', message: '请求超时，请稍后重试' }
    case 'ERR_ABORTED':
      return { code: 'REQUEST_ABORTED', message: '请求已取消' }
    case 'ERR_NETWORK':
      return { code: 'NETWORK_ERROR', message: '网络连接失败' }
    case 'ERR_SCHEMA':
      return { code: 'INVALID_API_RESPONSE', message: '服务器响应不符合 API 契约' }
    case 'ERR_DEBOUNCED':
      return { code: 'REQUEST_DEBOUNCED', message: '请求已被较新的调用替代' }
    case 'ERR_THROTTLED':
      return { code: 'REQUEST_THROTTLED', message: '请求过于频繁' }
    default:
      return { code: 'REQUEST_FAILED', message: '请求失败' }
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const encoded = document.cookie
    .split('; ')
    .find((item) => item.startsWith(name + '='))
    ?.slice(name.length + 1)
  if (encoded === undefined) return null
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

async function coordinateCookieRefresh(): Promise<boolean> {
  const lockManager = cookieRefreshLockManager()
  if (lockManager !== null) {
    return lockManager.request('jingwei-auth-refresh', { mode: 'exclusive' }, async () => {
      if (await hasAuthenticatedAccessCookie()) return true
      return requestCookieRefresh()
    })
  }
  return requestCookieRefresh()
}

interface CookieRefreshLockManager {
  request(
    name: string,
    options: { readonly mode: 'exclusive' },
    callback: () => Promise<boolean>,
  ): Promise<boolean>
}

function cookieRefreshLockManager(): CookieRefreshLockManager | null {
  const browserNavigator: unknown = Reflect.get(globalThis, 'navigator')
  if (typeof browserNavigator !== 'object' || browserNavigator === null) return null
  const candidate: unknown = Reflect.get(browserNavigator, 'locks')
  if (typeof candidate !== 'object' || candidate === null || !('request' in candidate)) return null
  return typeof candidate.request === 'function' ? (candidate as CookieRefreshLockManager) : null
}

async function hasAuthenticatedAccessCookie(): Promise<boolean> {
  try {
    const response = await globalThis.fetch('/api/v1/iam/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return false
    const body: unknown = await response.json()
    return (
      typeof body === 'object' &&
      body !== null &&
      'authenticated' in body &&
      body.authenticated === true
    )
  } catch {
    return false
  }
}

async function requestCookieRefresh(): Promise<boolean> {
  const csrfToken = readCookie(csrfCookieName)
  if (csrfToken === null) return false
  try {
    const response = await globalThis.fetch(refreshTokenCookiePath, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        [csrfHeaderName]: csrfToken,
      },
    })
    if (response.ok) return true
    if (response.status !== 409) return false

    // A non-Web-Locks browser may race another tab. The winning response publishes the new
    // cookies; a short yield lets the shared cookie jar observe them before the original retry.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25)
    })
    return await hasAuthenticatedAccessCookie()
  } catch {
    return false
  }
}

function shouldAttemptRefresh(url: string, init: FetchAdapterInit, response: Response): boolean {
  if (response.status !== 401 || isUnrepeatableBody(init.body)) return false
  const path = requestPath(url)
  if (path === refreshTokenCookiePath) return false
  return !(path === '/api/v1/iam/sessions' && init.method.toUpperCase() === 'POST')
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // Retrying must not fail merely because a runtime cannot cancel an unread body.
  }
}

function isUnrepeatableBody(body: BodyInit | null | undefined): boolean {
  return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
}

function requestPath(url: string): string {
  try {
    return new URL(url, 'http://jingwei.local').pathname
  } catch {
    return url
  }
}
