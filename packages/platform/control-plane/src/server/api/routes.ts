import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { ApplicationError, toTenantId, type PlatformAuthContext } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'
import type { ManageTenants } from '@jingwei/tenancy'

import {
  platformAccessTokenCookieName,
  platformCsrfCookieName,
  platformCsrfHeaderName,
  platformRefreshTokenCookieName,
  platformRefreshTokenCookiePath,
} from '../../shared/index.js'
import type {
  AuthenticateOperator,
  OperatorSessionLifecycle,
  ReadOperatorSession,
} from '../application/operator-auth.js'
import type { ProvisionTenant } from '../application/provision-tenant.js'
import type {
  CreatedOperatorSession,
  OperatorSessionCredentials,
  OperatorSessionService,
} from '../operator-session.js'
import { controlPlaneApiRoutes } from './openapi.js'

interface ControlPlaneLogger {
  info(context: Readonly<Record<string, unknown>>, message: string): void
  warn(context: Readonly<Record<string, unknown>>, message: string): void
}

export function createControlPlaneRoutes(dependencies: {
  readonly authenticate: Pick<AuthenticateOperator, 'execute'>
  readonly readSession: Pick<ReadOperatorSession, 'execute'>
  readonly sessionLifecycle: Pick<OperatorSessionLifecycle, 'logout'>
  readonly sessions: Pick<OperatorSessionService, 'refresh'>
  readonly tenants: ManageTenants
  readonly provision: ProvisionTenant
  readonly secureCookies: boolean
  readonly logger: ControlPlaneLogger
}) {
  const app = createApiRouter()
  app.use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(controlPlaneApiRoutes.createSession, async (context) => {
    try {
      const requestMetadata = context.get('requestMetadata')
      const authenticated = await dependencies.authenticate.execute(context.req.valid('json'), {
        requestId: context.get('requestId'),
        ...requestMetadata,
      })
      setSessionCookies(context, authenticated.session, dependencies.secureCookies)
      dependencies.logger.info(
        {
          requestId: context.get('requestId'),
          operatorId: authenticated.operator.id,
          module: 'control-plane',
          action: 'operator.login',
        },
        'control-plane.authentication.succeeded',
      )
      return context.json(
        {
          operator: authenticated.operator,
          session: sessionLifetime(authenticated.session),
        },
        201,
      )
    } catch (error) {
      dependencies.logger.warn(
        {
          requestId: context.get('requestId'),
          module: 'control-plane',
          action: 'operator.login',
          result: 'failure',
        },
        'control-plane.authentication.failed',
      )
      throw error
    }
  })
  app.openapi(controlPlaneApiRoutes.getSession, async (context) => {
    const auth = context.get('platformAuthContext')
    if (auth === null) return context.json({ authenticated: false } as const, 200)
    return context.json(await dependencies.readSession.execute(auth), 200)
  })
  app.openapi(controlPlaneApiRoutes.refreshSession, async (context) => {
    const refreshToken = getCookie(context, platformRefreshTokenCookieName)
    if (refreshToken === undefined) {
      clearSessionCookies(context)
      throw refreshFailed()
    }
    const result = await dependencies.sessions.refresh({
      refreshToken,
      csrfCookieToken: getCookie(context, platformCsrfCookieName),
      csrfHeaderToken: context.req.header(platformCsrfHeaderName),
    })
    if (result.status === 'csrf_invalid') throw csrfFailed()
    if (result.status === 'already_rotated') throw refreshInProgress()
    if (result.status !== 'refreshed') {
      clearSessionCookies(context)
      throw refreshFailed()
    }
    setCredentialCookies(context, result.session, dependencies.secureCookies)
    return context.json(sessionLifetime(result.session), 200)
  })
  app.openapi(controlPlaneApiRoutes.deleteSession, async (context) => {
    const auth = requirePlatformAuth(context)
    try {
      await dependencies.sessionLifecycle.logout(auth)
    } finally {
      clearSessionCookies(context)
    }
    return context.body(null, 204)
  })
  app.openapi(controlPlaneApiRoutes.listTenants, async (context) => {
    requirePlatformAuth(context)
    return context.json({ tenants: [...(await dependencies.tenants.list())] }, 200)
  })
  app.openapi(controlPlaneApiRoutes.createTenant, async (context) =>
    context.json(
      await dependencies.provision.create(
        platformAuditContext(requirePlatformAuth(context)),
        context.req.valid('json'),
      ),
      201,
    ),
  )
  app.openapi(controlPlaneApiRoutes.getTenant, async (context) => {
    requirePlatformAuth(context)
    return context.json(
      await dependencies.tenants.get(parseTenantId(context.req.valid('param').tenantId)),
      200,
    )
  })
  app.openapi(controlPlaneApiRoutes.retryTenant, async (context) =>
    context.json(
      await dependencies.provision.retry(
        platformAuditContext(requirePlatformAuth(context)),
        parseTenantId(context.req.valid('param').tenantId),
        context.req.valid('json'),
      ),
      200,
    ),
  )
  app.openapi(controlPlaneApiRoutes.suspendTenant, async (context) => {
    const auth = requirePlatformAuth(context)
    return context.json(
      await dependencies.tenants.suspend(
        platformAuditContext(auth),
        parseTenantId(context.req.valid('param').tenantId),
      ),
      200,
    )
  })
  app.openapi(controlPlaneApiRoutes.resumeTenant, async (context) => {
    const auth = requirePlatformAuth(context)
    return context.json(
      await dependencies.tenants.resume(
        platformAuditContext(auth),
        parseTenantId(context.req.valid('param').tenantId),
      ),
      200,
    )
  })
  app.openapi(controlPlaneApiRoutes.disableTenant, async (context) => {
    const auth = requirePlatformAuth(context)
    return context.json(
      await dependencies.tenants.disable(
        platformAuditContext(auth),
        parseTenantId(context.req.valid('param').tenantId),
      ),
      200,
    )
  })
  return app
}

function platformAuditContext(context: PlatformAuthContext) {
  return {
    requestId: context.requestId,
    actor: { type: 'PLATFORM_OPERATOR' as const, id: context.operatorId },
    ...(context.ipAddress === undefined ? {} : { ipAddress: context.ipAddress }),
    ...(context.userAgent === undefined ? {} : { userAgent: context.userAgent }),
  }
}

function requirePlatformAuth(context: Context<ServerAppEnv>): PlatformAuthContext {
  const auth = context.get('platformAuthContext')
  if (auth === null) {
    throw new ApplicationError({
      code: 'PLATFORM_AUTHENTICATION_REQUIRED',
      message: '需要平台管理员登录后访问',
      status: 401,
    })
  }
  return auth
}

function parseTenantId(value: string) {
  try {
    return toTenantId(value)
  } catch {
    throw new ApplicationError({
      code: 'INVALID_REQUEST',
      message: '租户 ID 格式不正确',
      status: 400,
    })
  }
}

function setSessionCookies(
  context: Context<ServerAppEnv>,
  session: CreatedOperatorSession,
  secure: boolean,
): void {
  setCredentialCookies(context, session, secure)
  setCookie(context, platformCsrfCookieName, session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'Strict',
    path: '/',
    expires: session.absoluteExpiresAt,
  })
}

function setCredentialCookies(
  context: Context<ServerAppEnv>,
  session: OperatorSessionCredentials,
  secure: boolean,
): void {
  setCookie(context, platformAccessTokenCookieName, session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: '/api/v1/platform',
    expires: session.accessExpiresAt,
  })
  setCookie(context, platformRefreshTokenCookieName, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: platformRefreshTokenCookiePath,
    expires: session.absoluteExpiresAt,
  })
}

function clearSessionCookies(context: Context<ServerAppEnv>): void {
  deleteCookie(context, platformAccessTokenCookieName, { path: '/api/v1/platform' })
  deleteCookie(context, platformRefreshTokenCookieName, { path: platformRefreshTokenCookiePath })
  deleteCookie(context, platformCsrfCookieName, { path: '/' })
}

function sessionLifetime(session: OperatorSessionCredentials) {
  return {
    accessExpiresAt: session.accessExpiresAt.toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
  }
}

function refreshFailed(): ApplicationError {
  return new ApplicationError({
    code: 'PLATFORM_AUTHENTICATION_REFRESH_FAILED',
    message: '平台登录状态已失效，请重新登录',
    status: 401,
  })
}

function refreshInProgress(): ApplicationError {
  return new ApplicationError({
    code: 'PLATFORM_AUTHENTICATION_REFRESH_IN_PROGRESS',
    message: '平台登录状态已在其他页面续期，请重试',
    status: 409,
  })
}

function csrfFailed(): ApplicationError {
  return new ApplicationError({
    code: 'PLATFORM_CSRF_VALIDATION_FAILED',
    message: '平台请求 CSRF 校验失败',
    status: 403,
  })
}
