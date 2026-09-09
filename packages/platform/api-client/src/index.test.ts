import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  createModuleApiClient,
  executeApiRequest,
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

const schema = z.object({ value: z.string() })
const api = createModuleApiClient<TestPaths, '/api/v1/test'>('/api/v1/test')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('platform API client', () => {
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
