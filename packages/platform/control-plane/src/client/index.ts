import { createRequest, type FetchAdapter, type FetchAdapterInit } from '@soybeanjs/fetch'
import { createTypedClient, toFlatTypedClient } from '@soybeanjs/fetch/openapi'

import {
  executeApiRequest,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  platformCsrfCookieName,
  platformCsrfHeaderName,
  platformLoginResultSchema,
  platformRefreshTokenCookiePath,
  platformSessionStatusSchema,
  platformTenantListSchema,
  platformTenantSchema,
  type CreatePlatformTenant,
  type PlatformLoginInput,
  type PlatformLoginResult,
  type PlatformSessionStatus,
  type PlatformTenant,
  type RetryPlatformTenant,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
let refreshPromise: Promise<boolean> | null = null

const platformCookieAdapter: FetchAdapter = async (url, init) => {
  const response = await globalThis.fetch(url, init)
  if (!shouldRefresh(url, init, response)) return response
  if (!(await refreshPlatformSession())) return response
  await response.body?.cancel().catch(() => undefined)
  return globalThis.fetch(url, init)
}

const request = createRequest<unknown, unknown>(
  {
    credentials: 'include',
    adapter: platformCookieAdapter,
    requestCache: 'no-store',
    retry: { retries: 0 },
    timeout: 30_000,
    onRequest(context) {
      context.options.headers.set('accept', 'application/json')
      if (safeMethods.has(context.options.method.toUpperCase())) return
      const token = readCookie(platformCsrfCookieName)
      if (token !== null) context.options.headers.set(platformCsrfHeaderName, token)
    },
  },
  { isBackendSuccess: () => true },
)
const api = {
  client: toFlatTypedClient<paths, '/api/v1/platform'>(request, '/api/v1/platform'),
  throwingClient: createTypedClient<paths, '/api/v1/platform'>(request, '/api/v1/platform'),
}

export function loginPlatformOperator(
  input: PlatformLoginInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<PlatformLoginResult>> {
  return toApiResult(
    api.client.post('/sessions', {
      body: input,
      schema: platformLoginResultSchema,
      ...options,
    }),
  )
}

export async function getPlatformSessionStatus(): Promise<PlatformSessionStatus> {
  let status = await executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: platformSessionStatusSchema }),
  )
  if (status.authenticated || !(await refreshPlatformSession())) return status
  status = await executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: platformSessionStatusSchema }),
  )
  return status
}

export function logoutPlatformOperator(): Promise<void> {
  return executeApiRequest(() => api.throwingClient.delete('/sessions/current'))
}

export function listPlatformTenants(
  options?: ApiRequestOptions,
): Promise<ApiResult<{ tenants: PlatformTenant[] }>> {
  return toApiResult(api.client.get('/tenants', { schema: platformTenantListSchema, ...options }))
}

export function createPlatformTenant(
  input: CreatePlatformTenant,
  options?: ApiRequestOptions,
): Promise<ApiResult<PlatformTenant>> {
  const { adminEmail, ...required } = input
  return toApiResult(
    api.client.post('/tenants', {
      body: { ...required, ...(adminEmail === undefined ? {} : { adminEmail }) },
      schema: platformTenantSchema,
      ...options,
    }),
  )
}

export function getPlatformTenant(
  tenantId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<PlatformTenant>> {
  return toApiResult(
    api.client.get('/tenants/{tenantId}', {
      pathParams: { tenantId },
      schema: platformTenantSchema,
      ...options,
    }),
  )
}

export function retryPlatformTenant(
  tenantId: string,
  input: RetryPlatformTenant,
  options?: ApiRequestOptions,
): Promise<ApiResult<PlatformTenant>> {
  const { adminEmail, ...required } = input
  return toApiResult(
    api.client.post('/tenants/{tenantId}/retry', {
      pathParams: { tenantId },
      body: { ...required, ...(adminEmail === undefined ? {} : { adminEmail }) },
      schema: platformTenantSchema,
      ...options,
    }),
  )
}

export function transitionPlatformTenant(
  tenantId: string,
  action: 'suspend' | 'resume' | 'disable',
  options?: ApiRequestOptions,
): Promise<ApiResult<PlatformTenant>> {
  const requestOptions = {
    pathParams: { tenantId },
    schema: platformTenantSchema,
    ...options,
  }
  switch (action) {
    case 'suspend':
      return toApiResult(api.client.post('/tenants/{tenantId}/suspend', requestOptions))
    case 'resume':
      return toApiResult(api.client.post('/tenants/{tenantId}/resume', requestOptions))
    case 'disable':
      return toApiResult(
        api.client.post('/tenants/{tenantId}/disable', {
          ...requestOptions,
        }),
      )
  }
}

function refreshPlatformSession(): Promise<boolean> {
  if (refreshPromise !== null) return refreshPromise
  const csrfToken = readCookie(platformCsrfCookieName)
  if (csrfToken === null) return Promise.resolve(false)
  refreshPromise = globalThis
    .fetch(platformRefreshTokenCookiePath, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json', [platformCsrfHeaderName]: csrfToken },
    })
    .then((response) => response.ok || response.status === 409)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

function shouldRefresh(url: string, init: FetchAdapterInit, response: Response): boolean {
  if (response.status !== 401) return false
  const path = requestPath(url)
  if (path === platformRefreshTokenCookiePath) return false
  return !(path === '/api/v1/platform/sessions' && init.method.toUpperCase() === 'POST')
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = document.cookie
    .split('; ')
    .find((item) => item.startsWith(name + '='))
    ?.slice(name.length + 1)
  if (value === undefined) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function requestPath(url: string): string {
  try {
    return new URL(url, 'http://jingwei.local').pathname
  } catch {
    return url
  }
}
