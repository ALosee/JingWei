import type { Context } from 'hono'

import type { TenantDirectory } from '@jingwei/database'
import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'

import type { ManageNavigation } from '../application/manage-navigation.js'
import type { ResolveNavigation } from '../application/resolve-navigation.js'
import { navigationApiRoutes } from './openapi.js'

function auth(context: Context<ServerAppEnv>) {
  const value = context.get('authContext')
  if (value === null)
    throw new ApplicationError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '需要登录后访问',
      status: 401,
    })
  return value
}

/** Anonymous tenant selection never affects authenticated tenant scope. All mutations use the platform CSRF middleware. */
export function createNavigationRoutes(
  resolve: ResolveNavigation,
  manage: ManageNavigation,
  tenants: TenantDirectory,
  bootstrapTenantCode: string,
) {
  const app = createApiRouter()
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(navigationApiRoutes.bootstrap, async (c) => {
    const current = c.get('authContext')
    if (current !== null) return c.json(await resolve.bootstrap(current.tenantId), 200)
    const tenant = await tenants.findActiveByCode(
      c.req.valid('query').tenantCode ?? bootstrapTenantCode,
    )
    if (tenant === null)
      throw new ApplicationError({
        code: 'NAVIGATION_TENANT_UNAVAILABLE',
        message: '启动租户不可用',
        status: 404,
      })
    return c.json(await resolve.bootstrap(tenant.id), 200)
  })
  app.openapi(navigationApiRoutes.me, async (c) => c.json(await resolve.forUser(auth(c)), 200))
  app.openapi(navigationApiRoutes.admin, async (c) => c.json(await manage.list(auth(c)), 200))
  app.openapi(navigationApiRoutes.catalog, async (c) => c.json(await manage.catalog(auth(c)), 200))
  app.openapi(navigationApiRoutes.createDraft, async (c) =>
    c.json(await manage.createDraft(auth(c), c.req.valid('json').sourceVersionId), 201),
  )
  app.openapi(navigationApiRoutes.getVersion, async (c) =>
    c.json(await manage.version(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(navigationApiRoutes.saveVersion, async (c) =>
    c.json(await manage.save(auth(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  app.openapi(navigationApiRoutes.validateVersion, async (c) =>
    c.json(await manage.validate(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(navigationApiRoutes.publishVersion, async (c) =>
    c.json(await manage.publish(auth(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  app.openapi(navigationApiRoutes.rollbackVersion, async (c) =>
    c.json(await manage.publish(auth(c), c.req.valid('param').id, c.req.valid('json'), true), 200),
  )
  app.openapi(navigationApiRoutes.deleteDraft, async (c) =>
    c.json(await manage.deleteDraft(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(navigationApiRoutes.getRoleGrants, async (c) =>
    c.json(await manage.roleCodes(auth(c), c.req.valid('param').roleId), 200),
  )
  app.openapi(navigationApiRoutes.saveRoleGrants, async (c) =>
    c.json(await manage.grantRole(auth(c), c.req.valid('param').roleId, c.req.valid('json')), 200),
  )
  return app
}
