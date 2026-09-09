import { deleteCookie, setCookie } from 'hono/cookie'

import { csrfCookieName, sessionCookieName, type SessionService } from '@jingwei/auth'
import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter } from '@jingwei/module-sdk/server'

import type { AuthenticateUser } from '../application/authenticate-user.js'
import { iamApiRoutes } from './openapi.js'

export function createIamRoutes(dependencies: {
  readonly authenticateUser: AuthenticateUser
  readonly sessions: SessionService
  readonly secureCookies: boolean
}) {
  const app = createApiRouter()
  app.openapi(iamApiRoutes.createSession, async (context) => {
    const input = context.req.valid('json')
    const userAgent = context.req.header('user-agent')
    const ipAddress = context.req.header('x-forwarded-for')
    const authenticated = await dependencies.authenticateUser.execute(input, {
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(ipAddress === undefined ? {} : { ipAddress }),
    })
    setCookie(context, sessionCookieName, authenticated.session.token, {
      httpOnly: true,
      secure: dependencies.secureCookies,
      sameSite: 'Lax',
      path: '/',
      expires: authenticated.session.absoluteExpiresAt,
    })
    setCookie(context, csrfCookieName, authenticated.session.csrfToken, {
      httpOnly: false,
      secure: dependencies.secureCookies,
      sameSite: 'Lax',
      path: '/',
      expires: authenticated.session.absoluteExpiresAt,
    })

    return context.json(
      { user: authenticated.user, csrfToken: authenticated.session.csrfToken },
      201,
    )
  })
  app.openapi(iamApiRoutes.getSession, (context) => {
    const auth = context.get('authContext')
    if (auth === null) return context.json({ authenticated: false } as const, 200)
    return context.json(
      {
        authenticated: true,
        user: { id: auth.userId, tenantId: auth.tenantId },
      },
      200,
    )
  })
  app.openapi(iamApiRoutes.deleteSession, async (context) => {
    const auth = context.get('authContext')
    if (auth === null) throw unauthenticated()
    await dependencies.sessions.revoke(auth.sessionId)
    deleteCookie(context, sessionCookieName, { path: '/' })
    deleteCookie(context, csrfCookieName, { path: '/' })
    return context.body(null, 204)
  })
  return app
}

function unauthenticated(): ApplicationError {
  return new ApplicationError({
    code: 'AUTHENTICATION_REQUIRED',
    message: '需要登录后访问',
    status: 401,
  })
}
