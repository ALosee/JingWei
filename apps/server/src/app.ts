import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'

import type { ServerAppEnv } from '@jingwei/module-sdk/server'

import type { Runtime } from './bootstrap/runtime.js'
import { generatedServerModules } from './generated/modules.js'
import { installHttpErrors } from './http/errors.js'
import { openApiDocumentConfig, registerOpenApiSecuritySchemes } from './http/openapi.js'
import { createSystemRoutes } from './http/system-routes.js'
import { requestContextMiddleware } from './middleware/request-context.js'

/** HTTP composition only. Importing this factory does not create resources or listen on a port. */
export async function createApp(runtime: Runtime) {
  const app = new OpenAPIHono<ServerAppEnv>()
  app.use('*', ...requestContextMiddleware(runtime))
  registerOpenApiSecuritySchemes(app)
  app.route('/', createSystemRoutes(runtime.moduleRegistry.editionId))
  const api = new OpenAPIHono<ServerAppEnv>()
  for (const module of generatedServerModules) {
    const installed = await module.install(runtime)
    api.route(installed.basePath, installed.routes)
  }
  app.route('/api/v1', api)
  app.doc31('/openapi/v1.json', openApiDocumentConfig)
  app.get(
    '/docs',
    Scalar({
      pageTitle: 'Jingwei API Reference',
      theme: 'default',
      url: '/openapi/v1.json',
      hideModels: false,
    }),
  )
  installHttpErrors(app, runtime.logger)
  return app
}
