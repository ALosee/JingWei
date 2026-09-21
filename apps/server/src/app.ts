import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'

import { createControlPlaneServer } from '@jingwei/control-plane/server'
import { assertApiAuthorizationContracts, type ServerAppEnv } from '@jingwei/module-sdk/server'

import type { Runtime } from './bootstrap/runtime.js'
import { createGeneratedServerModules } from './generated/modules.js'
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
  api.route(
    '/platform',
    await createControlPlaneServer({
      database: runtime.database,
      config: runtime.config,
      logger: runtime.logger,
      registry: runtime.moduleRegistry,
      tenantSessions: runtime.sessionService,
      operatorSessions: runtime.operatorSessionService,
    }),
  )
  for (const module of createGeneratedServerModules(runtime)) {
    const installed = await module.install(runtime)
    api.route(installed.basePath, installed.routes)
  }
  app.route('/api/v1', api)
  assertApiAuthorizationContracts(app.openAPIRegistry.definitions, runtime.moduleRegistry)
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
