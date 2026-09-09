import { createRequest, FetchError, type FetchRequestConfig } from '@soybeanjs/fetch'
import { createTypedClient, toFlatTypedClient } from '@soybeanjs/fetch/openapi'

import { csrfCookieName, csrfHeaderName } from '@jingwei/auth/shared'
import { apiErrorSchema } from '@jingwei/http-contract'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
const globalLoadingListeners = new Set<(loading: boolean) => void>()
let globalLoading = false

const request = createRequest<unknown, unknown>(
  {
    credentials: 'include',
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
