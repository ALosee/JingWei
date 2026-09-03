import { Hono } from 'hono'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'
import type { Runtime } from './bootstrap/runtime.js'
import { generatedServerModules } from './generated/modules.js'
import { installHttpErrors } from './http/errors.js'
import { createSystemRoutes } from './http/system-routes.js'
import { requestContextMiddleware } from './middleware/request-context.js'

/** HTTP composition only. Importing this factory does not create resources or listen on a port. */
export async function createApp(runtime: Runtime) {
  const app = new Hono<ServerAppEnv>()
  app.use('*', ...requestContextMiddleware(runtime))
  app.route('/', createSystemRoutes(runtime.moduleRegistry.editionId))
  const api = new Hono<ServerAppEnv>()
  for (const module of generatedServerModules) {
    const installed = await module.install(runtime)
    api.route(installed.basePath, installed.routes)
  }
  app.route('/api/v1', api)
  installHttpErrors(app, runtime.logger)
  return app
}
