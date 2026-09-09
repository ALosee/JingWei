import {
  createModuleApiClient,
  executeApiRequest,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  loginResultSchema,
  sessionStatusSchema,
  type LoginInput,
  type LoginResult,
  type SessionStatus,
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
 * Restores the HttpOnly-cookie session state without turning the normal anonymous state into a
 * failed HTTP request. The raw session token remains inaccessible to browser JavaScript.
 */
export function getSessionStatus(): Promise<SessionStatus> {
  return executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: sessionStatusSchema }),
  )
}

export function logout(): Promise<void> {
  return executeApiRequest(() => api.throwingClient.delete('/sessions/current'))
}
