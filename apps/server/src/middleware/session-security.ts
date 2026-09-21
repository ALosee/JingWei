import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

import {
  accessTokenCookieName,
  csrfCookieName,
  csrfHeaderName,
  isAllowedOrigin,
  isValidCsrfToken,
  requiresOriginValidation,
  type SessionService,
} from '@jingwei/auth'
import { isPlatformApiPath } from '@jingwei/control-plane/shared'
import { ApplicationError, type AuthContext } from '@jingwei/kernel'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

/** Establish optional identity and protect unsafe cookie requests; route authorization remains separate. */
export function sessionSecurity(dependencies: {
  readonly sessions: Pick<SessionService, 'authenticateAccess'>
  readonly appOrigin: string
}): MiddlewareHandler<ServerAppEnv> {
  return async (context, next) => {
    if (isPlatformApiPath(context.req.path)) {
      await next()
      return
    }
    const requestId = context.get('requestId')
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

    const token = getCookie(context, accessTokenCookieName)
    if (token !== undefined) {
      const session = await dependencies.sessions.authenticateAccess(token)
      if (session !== null) {
        const authContext: AuthContext = {
          requestId,
          tenantId: session.tenantId,
          userId: session.userId,
          sessionId: session.id,
          roleIds: [],
        }
        context.set('authContext', authContext)

        if (
          requiresOriginValidation(method) &&
          !isValidCsrfToken({
            cookieToken: getCookie(context, csrfCookieName),
            headerToken: context.req.header(csrfHeaderName),
            expectedHash: session.csrfTokenHash,
          })
        ) {
          throw new ApplicationError({
            code: 'CSRF_VALIDATION_FAILED',
            message: 'CSRF 校验失败',
            status: 403,
          })
        }
      }
    }
    await next()
  }
}
