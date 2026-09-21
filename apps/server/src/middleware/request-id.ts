import type { MiddlewareHandler } from 'hono'

import { newRequestId, toRequestId } from '@jingwei/kernel'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

export function correlateRequest(): MiddlewareHandler<ServerAppEnv> {
  return async (context, next) => {
    const requestId = parseRequestId(context.req.header('x-request-id'))
    context.set('requestId', requestId)
    context.header('x-request-id', requestId)
    context.set('authContext', null)
    context.set('platformAuthContext', null)
    context.set('requestMetadata', {})
    await next()
  }
}

function parseRequestId(value: string | undefined) {
  if (value === undefined) return newRequestId()
  try {
    return toRequestId(value)
  } catch {
    return newRequestId()
  }
}
