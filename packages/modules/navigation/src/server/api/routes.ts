import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { TenantDirectory } from '@jingwei/database'
import { ApplicationError } from '@jingwei/kernel'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

import { publishSchema, saveDraftSchema, saveRoleGrantsSchema } from '../../shared/index.js'
import type { ManageNavigation } from '../application/manage-navigation.js'
import type { ResolveNavigation } from '../application/resolve-navigation.js'

const versionParam = z.object({ id: z.uuid() })
const roleParam = z.object({ roleId: z.uuid() })
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
const jsonHook = (result: { success: boolean }) => {
  if (!result.success)
    throw new ApplicationError({
      code: 'INVALID_REQUEST',
      message: '请求参数格式不正确',
      status: 400,
    })
}

/** Anonymous tenant selection never affects authenticated tenant scope. All mutations use the platform CSRF middleware. */
export function createNavigationRoutes(
  resolve: ResolveNavigation,
  manage: ManageNavigation,
  tenants: TenantDirectory,
  bootstrapTenantCode: string,
) {
  const app = new Hono<ServerAppEnv>()
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  return app
    .get(
      '/bootstrap',
      zValidator(
        'query',
        z.object({ tenantCode: z.string().trim().min(1).max(80).optional() }),
        jsonHook,
      ),
      async (c) => {
        const current = c.get('authContext')
        if (current !== null) return c.json(await resolve.bootstrap(current.tenantId))
        const tenant = await tenants.findActiveByCode(
          c.req.valid('query').tenantCode ?? bootstrapTenantCode,
        )
        if (tenant === null)
          throw new ApplicationError({
            code: 'NAVIGATION_TENANT_UNAVAILABLE',
            message: '启动租户不可用',
            status: 404,
          })
        return c.json(await resolve.bootstrap(tenant.id))
      },
    )
    .get('/me', async (c) => c.json(await resolve.forUser(auth(c))))
    .get('/admin', async (c) => c.json(await manage.list(auth(c))))
    .get('/catalog', async (c) => c.json(await manage.catalog(auth(c))))
    .post(
      '/drafts',
      zValidator('json', z.object({ sourceVersionId: z.uuid().nullable() }).strict(), jsonHook),
      async (c) =>
        c.json(await manage.createDraft(auth(c), c.req.valid('json').sourceVersionId), 201),
    )
    .get('/versions/:id', zValidator('param', versionParam, jsonHook), async (c) =>
      c.json(await manage.version(auth(c), c.req.valid('param').id)),
    )
    .put(
      '/versions/:id',
      zValidator('param', versionParam, jsonHook),
      zValidator('json', saveDraftSchema, jsonHook),
      async (c) => c.json(await manage.save(auth(c), c.req.valid('param').id, c.req.valid('json'))),
    )
    .post('/versions/:id/validate', zValidator('param', versionParam, jsonHook), async (c) =>
      c.json(await manage.validate(auth(c), c.req.valid('param').id)),
    )
    .post(
      '/versions/:id/publish',
      zValidator('param', versionParam, jsonHook),
      zValidator('json', publishSchema, jsonHook),
      async (c) =>
        c.json(await manage.publish(auth(c), c.req.valid('param').id, c.req.valid('json'))),
    )
    .post(
      '/versions/:id/rollback',
      zValidator('param', versionParam, jsonHook),
      zValidator('json', publishSchema, jsonHook),
      async (c) =>
        c.json(await manage.publish(auth(c), c.req.valid('param').id, c.req.valid('json'), true)),
    )
    .get('/roles/:roleId/grants', zValidator('param', roleParam, jsonHook), async (c) =>
      c.json(await manage.roleCodes(auth(c), c.req.valid('param').roleId)),
    )
    .put(
      '/roles/:roleId/grants',
      zValidator('param', roleParam, jsonHook),
      zValidator('json', saveRoleGrantsSchema, jsonHook),
      async (c) =>
        c.json(await manage.grantRole(auth(c), c.req.valid('param').roleId, c.req.valid('json'))),
    )
}
