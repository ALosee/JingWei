import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'

import { csrfCookieName, sessionCookieName, type SessionService } from '@jingwei/auth'
import { ApplicationError } from '@jingwei/kernel'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

import { loginInputSchema } from '../../shared/index.js'
import type { AuthenticateUser } from '../application/authenticate-user.js'

export function createIamRoutes(dependencies: {
  readonly authenticateUser: AuthenticateUser
  readonly sessions: SessionService
  readonly secureCookies: boolean
}) {
  return new Hono<ServerAppEnv>()
    .post('/sessions', zValidator('json', loginInputSchema), async (context) => {
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
    .get('/session', (context) => {
      const auth = context.get('authContext')
      if (auth === null) return context.json({ authenticated: false } as const)
      return context.json({
        authenticated: true,
        user: { id: auth.userId, tenantId: auth.tenantId },
      })
    })
    .delete('/sessions/current', async (context) => {
      const auth = context.get('authContext')
      if (auth === null) throw unauthenticated()
      await dependencies.sessions.revoke(auth.sessionId)
      deleteCookie(context, sessionCookieName, { path: '/' })
      deleteCookie(context, csrfCookieName, { path: '/' })
      return context.body(null, 204)
    })
}

function unauthenticated(): ApplicationError {
  return new ApplicationError({
    code: 'AUTHENTICATION_REQUIRED',
    message: '需要登录后访问',
    status: 401,
  })
}
