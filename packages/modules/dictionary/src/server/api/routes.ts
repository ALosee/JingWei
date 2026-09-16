import type { Context } from 'hono'

import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'

import type { ManageDictionary } from '../application/manage-dictionary.js'
import { dictionaryApiRoutes } from './openapi.js'

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

export function createDictionaryRoutes(manage: ManageDictionary) {
  const app = createApiRouter()
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(dictionaryApiRoutes.catalog, async (c) => c.json(await manage.catalog(auth(c)), 200))
  app.openapi(dictionaryApiRoutes.detail, async (c) =>
    c.json(await manage.detail(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(dictionaryApiRoutes.detailByCode, async (c) =>
    c.json(await manage.detailByCode(auth(c), c.req.valid('param').code), 200),
  )
  app.openapi(dictionaryApiRoutes.createCategory, async (c) =>
    c.json(await manage.createCategory(auth(c), c.req.valid('json')), 201),
  )
  app.openapi(dictionaryApiRoutes.updateCategory, async (c) =>
    c.json(await manage.updateCategory(auth(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  app.openapi(dictionaryApiRoutes.deleteCategory, async (c) =>
    c.json(
      await manage.deleteCategory(
        auth(c),
        c.req.valid('param').id,
        c.req.valid('query').expectedRevision,
      ),
      200,
    ),
  )
  app.openapi(dictionaryApiRoutes.createType, async (c) =>
    c.json(await manage.createType(auth(c), c.req.valid('json')), 201),
  )
  app.openapi(dictionaryApiRoutes.updateType, async (c) =>
    c.json(await manage.updateType(auth(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  app.openapi(dictionaryApiRoutes.createItem, async (c) =>
    c.json(await manage.createItem(auth(c), c.req.valid('param').id, c.req.valid('json')), 201),
  )
  app.openapi(dictionaryApiRoutes.updateItem, async (c) => {
    const params = c.req.valid('param')
    return c.json(
      await manage.updateItem(auth(c), params.id, params.itemId, c.req.valid('json')),
      200,
    )
  })
  return app
}
