import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

import { isAllowedOrigin, isValidCsrfToken, requiresOriginValidation } from '@jingwei/auth'
import type { OperatorSessionService } from '@jingwei/control-plane/server'
import {
  platformAccessTokenCookieName,
  platformCsrfCookieName,
  platformCsrfHeaderName,
  isPlatformApiPath,
} from '@jingwei/control-plane/shared'
import { ApplicationError, type PlatformAuthContext } from '@jingwei/kernel'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

/** Establishes the independent platform identity only for control-plane API paths. */
export function platformSessionSecurity(dependencies: {
  readonly sessions: Pick<OperatorSessionService, 'authenticateAccess'>
  readonly appOrigin: string
}): MiddlewareHandler<ServerAppEnv> {
  return async (context, next) => {
    if (!isPlatformApiPath(context.req.path)) {
      await next()
      return
    }
    const method = context.req.method.toUpperCase()
    if (
      requiresOriginValidation(method) &&
      !isAllowedOrigin(context.req.header('origin') ?? null, dependencies.appOrigin)
    ) {
      throw new ApplicationError({
        code: 'ORIGIN_NOT_ALLOWED',
        message: '请求来源不受信任',
        status: 403,
      })
    }
    const token = getCookie(context, platformAccessTokenCookieName)
    if (token !== undefined) {
      const session = await dependencies.sessions.authenticateAccess(token)
      if (session !== null) {
        const platformAuthContext: PlatformAuthContext = {
          requestId: context.get('requestId'),
          operatorId: session.operatorId,
          sessionId: session.id,
          ...context.get('requestMetadata'),
        }
        context.set('platformAuthContext', platformAuthContext)
        if (
          requiresOriginValidation(method) &&
          !isValidCsrfToken({
            cookieToken: getCookie(context, platformCsrfCookieName),
            headerToken: context.req.header(platformCsrfHeaderName),
            expectedHash: session.csrfTokenHash,
          })
        ) {
          throw new ApplicationError({
            code: 'PLATFORM_CSRF_VALIDATION_FAILED',
            message: '平台请求 CSRF 校验失败',
            status: 403,
          })
        }
      }
    }
    await next()
  }
}
