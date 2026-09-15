import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import {
  accessTokenCookieName,
  csrfCookieName,
  csrfHeaderName,
  refreshTokenCookieName,
  refreshTokenCookiePath,
  type CreatedSession,
  type SessionCredentials,
} from '@jingwei/auth'
import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'

import type {
  ChangeAccountPassword,
  ReadAccountProfile,
  ReadAccountRoles,
  UpdateAccountProfile,
} from '../application/account-profile.js'
import type { AuthenticateUser } from '../application/authenticate-user.js'
import type { ManageIamRoles } from '../application/manage-roles.js'
import type { ManageIamUsers } from '../application/manage-users.js'
import type { ReadSessionStatus } from '../application/read-session-status.js'
import type { SessionLifecycle } from '../application/session-lifecycle.js'
import { iamApiRoutes } from './openapi.js'

interface AuthenticationLogger {
  info(context: Readonly<Record<string, unknown>>, message: string): void
  warn(context: Readonly<Record<string, unknown>>, message: string): void
}

export function createIamRoutes(dependencies: {
  readonly authenticateUser: Pick<AuthenticateUser, 'execute'>
  readonly readSessionStatus: Pick<ReadSessionStatus, 'execute'>
  readonly sessions: Pick<SessionLifecycle, 'logout' | 'refresh'>
  readonly readAccount: Pick<ReadAccountProfile, 'execute'>
  readonly updateAccount: Pick<UpdateAccountProfile, 'execute'>
  readonly changePassword: Pick<ChangeAccountPassword, 'execute'>
  readonly readAccountRoles: Pick<ReadAccountRoles, 'execute'>
  readonly manageRoles: Pick<
    ManageIamRoles,
    | 'list'
    | 'get'
    | 'create'
    | 'update'
    | 'remove'
    | 'listPermissions'
    | 'listRolePermissions'
    | 'replacePermissions'
  >
  readonly manageUsers: Pick<
    ManageIamUsers,
    'list' | 'get' | 'create' | 'update' | 'resetPassword' | 'listRoles' | 'replaceRoles'
  >
  readonly secureCookies: boolean
  readonly logger: AuthenticationLogger
}) {
  const app = createApiRouter()
  app.use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(iamApiRoutes.createSession, async (context) => {
    const input = context.req.valid('json')
    const userAgent = boundedHeader(context.req.header('user-agent'), 512)
    const ipAddress = forwardedIp(context.req.header('x-forwarded-for'))
    try {
      const authenticated = await dependencies.authenticateUser.execute(input, {
        requestId: context.get('requestId'),
        ...(userAgent === undefined ? {} : { userAgent }),
        ...(ipAddress === undefined ? {} : { ipAddress }),
      })
      setSessionCookies(context, authenticated.session, dependencies.secureCookies)
      dependencies.logger.info(
        {
          requestId: context.get('requestId'),
          tenantId: authenticated.user.tenantId,
          userId: authenticated.user.id,
          module: 'iam',
          action: 'authentication.login',
        },
        'iam.authentication.succeeded',
      )

      return context.json(
        {
          user: authenticated.user,
          session: sessionLifetime(authenticated.session),
        },
        201,
      )
    } catch (error) {
      dependencies.logger.warn(
        {
          requestId: context.get('requestId'),
          module: 'iam',
          action: 'authentication.login',
          result: 'failure',
        },
        'iam.authentication.failed',
      )
      throw error
    }
  })
  app.openapi(iamApiRoutes.getSession, async (context) => {
    const auth = context.get('authContext')
    if (auth === null) return context.json({ authenticated: false } as const, 200)
    return context.json(await dependencies.readSessionStatus.execute(auth), 200)
  })
  app.openapi(iamApiRoutes.refreshSession, async (context) => {
    const refreshToken = getCookie(context, refreshTokenCookieName)
    if (refreshToken === undefined) {
      clearSessionCookies(context)
      throw refreshAuthenticationFailed()
    }

    const result = await dependencies.sessions.refresh({
      requestId: context.get('requestId'),
      refreshToken,
      csrfCookieToken: getCookie(context, csrfCookieName),
      csrfHeaderToken: context.req.header(csrfHeaderName),
    })
    if (result.status === 'csrf_invalid') throw csrfValidationFailed()
    if (result.status === 'already_rotated') throw refreshAlreadyRotated()
    if (result.status !== 'refreshed') {
      clearSessionCookies(context)
      if (result.status === 'reused') {
        dependencies.logger.warn(
          {
            requestId: context.get('requestId'),
            module: 'iam',
            action: 'authentication.refresh-reuse',
          },
          'iam.authentication.refresh-token-reuse',
        )
      }
      throw refreshAuthenticationFailed()
    }

    setCredentialCookies(context, result.session, dependencies.secureCookies)
    return context.json(sessionLifetime(result.session), 200)
  })
  app.openapi(iamApiRoutes.deleteSession, async (context) => {
    const auth = context.get('authContext')
    if (auth === null) throw unauthenticated()
    try {
      await dependencies.sessions.logout(auth)
    } finally {
      clearSessionCookies(context)
    }
    dependencies.logger.info(
      {
        requestId: context.get('requestId'),
        tenantId: auth.tenantId,
        userId: auth.userId,
        module: 'iam',
        action: 'authentication.logout',
      },
      'iam.authentication.logged-out',
    )
    return context.body(null, 204)
  })
  app.openapi(iamApiRoutes.getAccount, async (context) => {
    const auth = requireAuth(context)
    return context.json(
      await dependencies.readAccount.execute({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      200,
    )
  })
  app.openapi(iamApiRoutes.updateAccount, async (context) => {
    const auth = requireAuth(context)
    const profile = await dependencies.updateAccount.execute(
      {
        requestId: auth.requestId,
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
      context.req.valid('json'),
    )
    dependencies.logger.info(
      {
        requestId: auth.requestId,
        tenantId: auth.tenantId,
        userId: auth.userId,
        module: 'iam',
        action: 'account.profile.update',
      },
      'iam.account.profile-updated',
    )
    return context.json(profile, 200)
  })
  app.openapi(iamApiRoutes.changePassword, async (context) => {
    const auth = requireAuth(context)
    await dependencies.changePassword.execute(
      {
        requestId: auth.requestId,
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
      context.req.valid('json'),
    )
    clearSessionCookies(context)
    dependencies.logger.info(
      {
        requestId: auth.requestId,
        tenantId: auth.tenantId,
        userId: auth.userId,
        module: 'iam',
        action: 'account.password.change',
      },
      'iam.account.password-changed',
    )
    return context.body(null, 204)
  })
  app.openapi(iamApiRoutes.getAccountRoles, async (context) => {
    const auth = requireAuth(context)
    const roles = await dependencies.readAccountRoles.execute({
      tenantId: auth.tenantId,
      userId: auth.userId,
    })
    return context.json({ roles }, 200)
  })
  app.openapi(iamApiRoutes.listRoles, async (context) =>
    context.json(await dependencies.manageRoles.list(requireAuth(context)), 200),
  )
  app.openapi(iamApiRoutes.createRole, async (context) =>
    context.json(
      await dependencies.manageRoles.create(requireAuth(context), context.req.valid('json')),
      201,
    ),
  )
  app.openapi(iamApiRoutes.getRole, async (context) =>
    context.json(
      await dependencies.manageRoles.get(requireAuth(context), context.req.valid('param').roleId),
      200,
    ),
  )
  app.openapi(iamApiRoutes.updateRole, async (context) =>
    context.json(
      await dependencies.manageRoles.update(
        requireAuth(context),
        context.req.valid('param').roleId,
        context.req.valid('json'),
      ),
      200,
    ),
  )
  app.openapi(iamApiRoutes.deleteRole, async (context) =>
    context.json(
      await dependencies.manageRoles.remove(
        requireAuth(context),
        context.req.valid('param').roleId,
      ),
      200,
    ),
  )
  app.openapi(iamApiRoutes.listPermissionCatalog, async (context) =>
    context.json(await dependencies.manageRoles.listPermissions(requireAuth(context)), 200),
  )
  app.openapi(iamApiRoutes.listRolePermissions, async (context) =>
    context.json(
      await dependencies.manageRoles.listRolePermissions(
        requireAuth(context),
        context.req.valid('param').roleId,
      ),
      200,
    ),
  )
  app.openapi(iamApiRoutes.replaceRolePermissions, async (context) =>
    context.json(
      await dependencies.manageRoles.replacePermissions(
        requireAuth(context),
        context.req.valid('param').roleId,
        context.req.valid('json'),
      ),
      200,
    ),
  )
  app.openapi(iamApiRoutes.listUsers, async (context) =>
    context.json(await dependencies.manageUsers.list(requireAuth(context)), 200),
  )
  app.openapi(iamApiRoutes.createUser, async (context) =>
    context.json(
      await dependencies.manageUsers.create(requireAuth(context), context.req.valid('json')),
      201,
    ),
  )
  app.openapi(iamApiRoutes.getUser, async (context) =>
    context.json(
      await dependencies.manageUsers.get(requireAuth(context), context.req.valid('param').userId),
      200,
    ),
  )
  app.openapi(iamApiRoutes.updateUser, async (context) =>
    context.json(
      await dependencies.manageUsers.update(
        requireAuth(context),
        context.req.valid('param').userId,
        context.req.valid('json'),
      ),
      200,
    ),
  )
  app.openapi(iamApiRoutes.resetUserPassword, async (context) => {
    await dependencies.manageUsers.resetPassword(
      requireAuth(context),
      context.req.valid('param').userId,
      context.req.valid('json'),
    )
    return context.body(null, 204)
  })
  app.openapi(iamApiRoutes.listUserRoles, async (context) =>
    context.json(
      await dependencies.manageUsers.listRoles(
        requireAuth(context),
        context.req.valid('param').userId,
      ),
      200,
    ),
  )
  app.openapi(iamApiRoutes.replaceUserRoles, async (context) =>
    context.json(
      await dependencies.manageUsers.replaceRoles(
        requireAuth(context),
        context.req.valid('param').userId,
        context.req.valid('json'),
      ),
      200,
    ),
  )
  return app
}

function requireAuth(context: Context<ServerAppEnv>) {
  const auth = context.get('authContext')
  if (auth === null) throw unauthenticated()
  return auth
}

function setSessionCookies(
  context: Context<ServerAppEnv>,
  session: CreatedSession,
  secure: boolean,
): void {
  setCredentialCookies(context, session, secure)
  setCookie(context, csrfCookieName, session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'Strict',
    path: '/',
    expires: session.absoluteExpiresAt,
  })
}

function setCredentialCookies(
  context: Context<ServerAppEnv>,
  session: SessionCredentials,
  secure: boolean,
): void {
  setCookie(context, accessTokenCookieName, session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: '/',
    expires: session.accessExpiresAt,
  })
  setCookie(context, refreshTokenCookieName, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: refreshTokenCookiePath,
    expires: session.absoluteExpiresAt,
  })
}

function clearSessionCookies(context: Context<ServerAppEnv>): void {
  deleteCookie(context, accessTokenCookieName, { path: '/' })
  deleteCookie(context, refreshTokenCookieName, { path: refreshTokenCookiePath })
  deleteCookie(context, csrfCookieName, { path: '/' })
}

function sessionLifetime(session: SessionCredentials) {
  return {
    accessExpiresAt: session.accessExpiresAt.toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
  }
}

function unauthenticated(): ApplicationError {
  return new ApplicationError({
    code: 'AUTHENTICATION_REQUIRED',
    message: '需要登录后访问',
    status: 401,
  })
}

function refreshAuthenticationFailed(): ApplicationError {
  return new ApplicationError({
    code: 'AUTHENTICATION_REFRESH_FAILED',
    message: '登录状态已失效，请重新登录',
    status: 401,
  })
}

function refreshAlreadyRotated(): ApplicationError {
  return new ApplicationError({
    code: 'AUTHENTICATION_REFRESH_IN_PROGRESS',
    message: '登录状态已在其他页面续期，请重试',
    status: 409,
  })
}

function csrfValidationFailed(): ApplicationError {
  return new ApplicationError({
    code: 'CSRF_VALIDATION_FAILED',
    message: 'CSRF 校验失败',
    status: 403,
  })
}

function boundedHeader(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim()
  if (normalized === undefined || normalized.length === 0) return undefined
  return normalized.slice(0, maxLength)
}

function forwardedIp(value: string | undefined): string | undefined {
  return boundedHeader(value?.split(',', 1)[0], 64)
}
