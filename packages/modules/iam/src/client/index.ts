import { requestJson } from '@jingwei/api-client'

import {
  loginResultSchema,
  sessionStatusSchema,
  type LoginInput,
  type LoginResult,
  type SessionStatus,
} from '../shared/index.js'

export function login(input: LoginInput): Promise<LoginResult> {
  return requestJson({
    input: '/api/v1/iam/sessions',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
    schema: loginResultSchema,
  })
}

/**
 * Restores the HttpOnly-cookie session state without turning the normal anonymous state into a
 * failed HTTP request. The raw session token remains inaccessible to browser JavaScript.
 */
export function getSessionStatus(): Promise<SessionStatus> {
  return requestJson({ input: '/api/v1/iam/session', schema: sessionStatusSchema })
}
