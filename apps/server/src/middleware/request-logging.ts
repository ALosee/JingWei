import type { MiddlewareHandler } from 'hono'

import type { ServerAppEnv } from '@jingwei/module-sdk/server'
import type { AppLogger } from '@jingwei/observability'

export function requestLogging(logger: AppLogger): MiddlewareHandler<ServerAppEnv> {
  return async (context, next) => {
    const requestId = context.get('requestId')
    const method = context.req.method.toUpperCase()
    const startedAt = performance.now()
    try {
      await next()
    } finally {
      const auth = context.get('authContext')
      const platformAuth = context.get('platformAuthContext')
      logger.info(
        {
          requestId,
          tenantId: auth?.tenantId,
          userId: auth?.userId,
          operatorId: platformAuth?.operatorId,
          method,
          path: context.req.path,
          status: context.res.status,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        },
        'http.request',
      )
    }
  }
}
