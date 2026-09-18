import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  createModuleApiClient,
  executeApiRequest,
  postFormData,
  refreshCookieSession,
  subscribeGlobalApiLoading,
  toApiResult,
} from './index.js'
import { useApiRequestState } from './vue.js'

interface TestOperation {
  parameters: { query?: never; header?: never; path?: never; cookie?: never }
  requestBody?: never
  responses: {
    200: { content: { 'application/json': { value: string } } }
  }
}

interface TestMutation {
  parameters: { query?: never; header?: never; path?: never; cookie?: never }
  requestBody: { content: { 'application/json': { value: string } } }
  responses: {
    200: { content: { 'application/json': { value: string } } }
  }
}

interface TestDelete {
  parameters: { query?: never; header?: never; path?: never; cookie?: never }
  requestBody?: never
  responses: { 204: { content?: never } }
}

interface TestPathsDefinition {
  '/api/v1/test/resource': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never }
    get: TestOperation
    put?: never
    post: TestMutation
    delete: TestDelete
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}

type TestPaths = {
  [Path in keyof TestPathsDefinition]: TestPathsDefinition[Path]
}

interface LoginTestPathsDefinition {
  '/api/v1/iam/sessions': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never }
    get?: never
    put?: never
    post: TestMutation
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}

type LoginTestPaths = {
  [Path in keyof LoginTestPathsDefinition]: LoginTestPathsDefinition[Path]
}

const schema = z.object({ value: z.string() })
const api = createModuleApiClient<TestPaths, '/api/v1/test'>('/api/v1/test')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('platform API client', () => {
  it('sends multipart data through the shared CSRF and loading pipeline', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ value: 'uploaded' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', { cookie: 'jingwei_csrf=multipart-token' })
    const form = new FormData()
    form.set('purpose', 'LOGO')
    const requestState = useApiRequestState()

    const result = await postFormData('/api/v1/test/upload', form, schema, requestState.options)

    expect(result).toEqual({ data: { value: 'uploaded' }, error: null })
    expect(requestState.loading.value).toBe(false)
    const [, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)
    expect(init?.body).toBe(form)
    expect(headers.get('x-csrf-token')).toBe('multipart-token')
    expect(headers.has('content-type')).toBe(false)
  })

  it('keeps operation loading active until every tracked request settles', () => {
    const requestState = useApiRequestState()

    requestState.options.onLoadingChange?.(true)
    requestState.options.onLoadingChange?.(true)
    requestState.options.onLoadingChange?.(false)
    expect(requestState.loading.value).toBe(true)

    requestState.options.onLoadingChange?.(false)
    expect(requestState.loading.value).toBe(false)
  })

  it('adds credentials, JSON headers, and the CSRF token for mutations', async () => {
    const fetchMock = vi.fn((...args: Parameters<typeof fetch>) => {
      expect(args).toHaveLength(2)
      return Promise.resolve(
        new Response(JSON.stringify({ value: 'saved' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', { cookie: 'jingwei_csrf=csrf%20token' })
    const requestState = useApiRequestState()
    const globalLoading: boolean[] = []
    const unsubscribe = subscribeGlobalApiLoading((loading) => globalLoading.push(loading))

    const pending = toApiResult(
      api.client.post('/resource', {
        body: { value: 'saved' },
        schema,
        ...requestState.options,
      }),
    )
    expect(requestState.loading.value).toBe(true)
    const result = await pending
    unsubscribe()

    expect(result).toEqual({ data: { value: 'saved' }, error: null })
    expect(requestState.loading.value).toBe(false)
    expect(globalLoading).toEqual([false, true, false])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)
    expect(url).toBe('/api/v1/test/resource')
    expect(init?.credentials).toBe('include')
    expect(init?.cache).toBe('no-store')
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-csrf-token')).toBe('csrf token')
  })

  it('maps a structured non-success response to ApiClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'PERMISSION_DENIED',
              message: '没有权限',
              requestId: 'request-1',
              details: { permission: 'navigation.view' },
            }),
            { status: 403, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    )

    await expect(toApiResult(api.client.get('/resource', { schema }))).resolves.toMatchObject({
      data: null,
      error: {
        name: 'ApiClientError',
        code: 'PERMISSION_DENIED',
        message: '没有权限',
        requestId: 'request-1',
        status: 403,
        details: { permission: 'navigation.view' },
      },
    })
  })

  it('refreshes HttpOnly cookies once for concurrent 401 responses and retries each request', async () => {
    let accessActive = false
    let refreshRequests = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const path = new URL(rawUrl, 'http://jingwei.test').pathname
      if (path === '/api/v1/iam/sessions/refresh') {
        refreshRequests++
        accessActive = true
        return Promise.resolve(
          new Response(
            JSON.stringify({
              accessExpiresAt: '2026-09-10T10:10:00.000Z',
              absoluteExpiresAt: '2026-09-17T10:00:00.000Z',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify(
            accessActive
              ? { value: 'restored' }
              : {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: '需要登录',
                  requestId: 'request-auth',
                },
          ),
          {
            status: accessActive ? 200 : 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', { cookie: 'jingwei_csrf=csrf-token' })

    const [first, second] = await Promise.all([
      toApiResult(api.client.get('/resource', { schema })),
      toApiResult(api.client.get('/resource', { schema })),
    ])

    expect(first).toEqual({ data: { value: 'restored' }, error: null })
    expect(second).toEqual({ data: { value: 'restored' }, error: null })
    expect(refreshRequests).toBe(1)
    // Web Locks performs one authenticated-session probe while holding the cross-tab lock.
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('skips refresh coordination and its session probe when no CSRF cookie exists', async () => {
    const fetchMock = vi.fn()
    const lockRequest = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('navigator', { locks: { request: lockRequest } })

    await expect(refreshCookieSession()).resolves.toBe(false)

    expect(lockRequest).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not refresh after a rejected login attempt', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'AUTHENTICATION_FAILED',
            message: '租户、账号或密码不正确',
            requestId: 'request-login',
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', { cookie: 'jingwei_csrf=csrf-token' })

    const loginApi = createModuleApiClient<LoginTestPaths, '/api/v1/iam'>('/api/v1/iam')
    await expect(
      toApiResult(
        loginApi.client.post('/sessions', {
          body: { value: 'invalid' },
          schema,
        }),
      ),
    ).resolves.toMatchObject({ data: null, error: { code: 'AUTHENTICATION_FAILED' } })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns the original 401 when cross-tab refresh coordination is unavailable', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'AUTHENTICATION_REQUIRED',
            message: '需要登录',
            requestId: 'request-lock-failed',
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', { cookie: 'jingwei_csrf=csrf-token' })
    vi.stubGlobal('navigator', {
      locks: { request: vi.fn(() => Promise.reject(new Error('Web Locks unavailable'))) },
    })

    await expect(toApiResult(api.client.get('/resource', { schema }))).resolves.toMatchObject({
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED', status: 401 },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('supports successful 204 responses without attempting to parse JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    )

    await expect(toApiResult(api.client.delete('/resource'))).resolves.toEqual({
      data: undefined,
      error: null,
    })
  })

  it('rejects a successful response that violates its runtime schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ value: 42 }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'x-request-id': 'request-2' },
          }),
        ),
      ),
    )

    await expect(toApiResult(api.client.get('/resource', { schema }))).resolves.toMatchObject({
      data: null,
      error: {
        name: 'ApiClientError',
        code: 'INVALID_API_RESPONSE',
        requestId: null,
        status: null,
      },
    })
  })

  it('normalizes network failures without inventing an HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    )

    await expect(toApiResult(api.client.get('/resource', { schema }))).resolves.toMatchObject({
      data: null,
      error: {
        name: 'ApiClientError',
        code: 'NETWORK_ERROR',
        requestId: null,
        status: null,
      },
    })
  })

  it('distinguishes a timeout from a user cancellation', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe('/api/v1/test/resource')
        return new Promise<Response>((resolve, reject) => {
          const signal = init?.signal
          if (signal === undefined || signal === null) {
            resolve(new Response(null, { status: 500 }))
            return
          }
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        })
      }),
    )

    const pending = toApiResult(api.client.get('/resource', { schema, timeout: 1_000 }))
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toMatchObject({
      data: null,
      error: {
        name: 'ApiClientError',
        code: 'REQUEST_TIMEOUT',
        requestId: null,
        status: null,
      },
    })
  })

  it('keeps a throwing client as an explicit fail-fast escape hatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    )

    await expect(
      executeApiRequest(() => api.throwingClient.get('/resource', { schema })),
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'NETWORK_ERROR',
    })
  })
})
