import type { Context } from 'hono'

import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'
import type { TenantDirectory } from '@jingwei/tenancy'

import type { ManageBranding } from '../application/manage-branding.js'
import type { ResolveBranding } from '../application/resolve-branding.js'
import { brandingApiRoutes } from './openapi.js'

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

export function createBrandingRoutes(
  resolve: ResolveBranding,
  manage: ManageBranding,
  tenants: TenantDirectory,
  bootstrapTenantCode: string,
) {
  const app = createApiRouter()
  app.use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(brandingApiRoutes.bootstrap, async (context) => {
    const current = context.get('authContext')
    if (current !== null) return context.json(await resolve.effective(current.tenantId), 200)
    const tenant = await tenants.findActiveByCode(
      context.req.valid('query').tenantCode ?? bootstrapTenantCode,
    )
    if (tenant === null)
      throw new ApplicationError({
        code: 'BRANDING_TENANT_UNAVAILABLE',
        message: '启动租户不可用',
        status: 404,
      })
    return context.json(await resolve.effective(tenant.id), 200)
  })
  app.openapi(brandingApiRoutes.asset, async (context) => {
    const asset = await resolve.asset(context.req.valid('param').id)
    if (asset === null)
      throw new ApplicationError({
        code: 'BRANDING_ASSET_NOT_FOUND',
        message: '品牌素材不存在',
        status: 404,
      })
    context.header('Cache-Control', 'public, max-age=31536000, immutable')
    context.header('Content-Type', asset.contentType)
    context.header('ETag', `"${asset.id}"`)
    context.header('X-Content-Type-Options', 'nosniff')
    if (asset.contentType === 'image/svg+xml') {
      context.header(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox",
      )
    }
    return context.body(Uint8Array.from(asset.bytes).buffer, 200)
  })
  app.openapi(brandingApiRoutes.admin, async (context) =>
    context.json(await manage.list(auth(context)), 200),
  )
  app.openapi(brandingApiRoutes.createDraft, async (context) =>
    context.json(await manage.createDraft(auth(context), context.req.valid('json').source), 201),
  )
  app.openapi(brandingApiRoutes.getVersion, async (context) =>
    context.json(await manage.version(auth(context), context.req.valid('param').id), 200),
  )
  app.openapi(brandingApiRoutes.saveVersion, async (context) =>
    context.json(
      await manage.save(auth(context), context.req.valid('param').id, context.req.valid('json')),
      200,
    ),
  )
  app.openapi(brandingApiRoutes.publishVersion, async (context) =>
    context.json(
      await manage.publish(auth(context), context.req.valid('param').id, context.req.valid('json')),
      200,
    ),
  )
  app.openapi(brandingApiRoutes.rollbackVersion, async (context) =>
    context.json(
      await manage.publish(
        auth(context),
        context.req.valid('param').id,
        context.req.valid('json'),
        true,
      ),
      200,
    ),
  )
  app.openapi(brandingApiRoutes.deleteDraft, async (context) =>
    context.json(await manage.deleteDraft(auth(context), context.req.valid('param').id), 200),
  )
  app.openapi(brandingApiRoutes.restoreDefault, async (context) =>
    context.json(
      await manage.restoreDefault(
        auth(context),
        context.req.valid('json').expectedPublishedVersionId,
      ),
      200,
    ),
  )
  app.openapi(brandingApiRoutes.uploadAsset, async (context) => {
    const input = context.req.valid('form')
    return context.json(
      await manage.uploadAsset(
        auth(context),
        input.purpose,
        new Uint8Array(await input.file.arrayBuffer()),
      ),
      201,
    )
  })
  return app
}
