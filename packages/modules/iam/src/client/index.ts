import {
  createModuleApiClient,
  executeApiRequest,
  refreshCookieSession,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  accountProfileSchema,
  accountRolesSchema,
  loginResultSchema,
  sessionStatusSchema,
  type AccountProfile,
  type AccountRoles,
  type ChangePasswordInput,
  type LoginInput,
  type LoginResult,
  type SessionStatus,
  type UpdateAccountInput,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/iam'>('/api/v1/iam')

export function login(
  input: LoginInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<LoginResult>> {
  return toApiResult(
    api.client.post('/sessions', {
      body: input,
      schema: loginResultSchema,
      ...options,
    }),
  )
}

/**
 * Restores the HttpOnly-cookie session state and performs one refresh attempt when only the
 * long-lived cookie remains. Raw access and refresh tokens stay inaccessible to JavaScript.
 */
export async function getSessionStatus(): Promise<SessionStatus> {
  let status = await executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: sessionStatusSchema }),
  )
  if (status.authenticated || !(await refreshCookieSession())) return status

  status = await executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: sessionStatusSchema }),
  )
  return status
}

export function logout(): Promise<void> {
  return executeApiRequest(() => api.throwingClient.delete('/sessions/current'))
}

export function getAccountProfile(options?: ApiRequestOptions): Promise<ApiResult<AccountProfile>> {
  return toApiResult(
    api.client.get('/account', {
      schema: accountProfileSchema,
      ...options,
    }),
  )
}

export function updateAccountProfile(
  input: UpdateAccountInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<AccountProfile>> {
  const body = {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
  }
  return toApiResult(
    api.client.patch('/account', {
      body,
      schema: accountProfileSchema,
      ...options,
    }),
  )
}

export function changeAccountPassword(
  input: ChangePasswordInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<void>> {
  return toApiResult(
    api.client.post('/account/password', {
      body: input,
      ...options,
    }),
  )
}

export function getAccountRoles(options?: ApiRequestOptions): Promise<ApiResult<AccountRoles>> {
  return toApiResult(
    api.client.get('/account/roles', {
      schema: accountRolesSchema,
      ...options,
    }),
  )
}
