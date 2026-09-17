import { OpenAPIHono } from '@hono/zod-openapi'
import type { Hono } from 'hono'

import type { SessionService } from '@jingwei/auth'
import type { AppConfig } from '@jingwei/config'
import type { DatabaseRuntime, TenantDirectory } from '@jingwei/database'
import { ApplicationError, type AuthContext, type RequestId } from '@jingwei/kernel'
import type { AppLogger } from '@jingwei/observability'

import type { ModuleManifest } from './manifest.js'
import type { ModuleRegistry } from './registry.js'

export * from './api-authorization.js'

export interface ServerAppVariables {
  authContext: AuthContext | null
  requestId: RequestId
}

export interface ServerAppEnv {
  Variables: ServerAppVariables
}

/** Creates a module-owned OpenAPI router with the platform validation error contract. */
export function createApiRouter(): OpenAPIHono<ServerAppEnv> {
  return new OpenAPIHono<ServerAppEnv>({
    defaultHook(result) {
      if (!result.success)
        throw new ApplicationError({
          code: 'INVALID_REQUEST',
          message: '请求参数格式不正确',
          status: 400,
        })
    },
  })
}

export interface ServerModuleContext {
  readonly config: AppConfig
  readonly database: DatabaseRuntime
  readonly logger: AppLogger
  readonly moduleRegistry: ModuleRegistry
  readonly sessionService: SessionService
  readonly tenantDirectory: TenantDirectory
}

/** Result of installing one server module into the application composition root. */
export interface InstalledServerModule {
  readonly id: string
  readonly basePath: string
  readonly routes: Hono<ServerAppEnv>
  readonly dispose?: () => Promise<void>
}

/**
 * Server-side integration contract implemented by every business module.
 *
 * `install` may assemble repositories and use cases owned by this module, but it must not listen
 * on a port, close shared platform resources, scan for other modules, or mutate the resolved
 * Edition. Importing the module object itself must remain side-effect free.
 */
export interface ServerModule {
  readonly manifest: ModuleManifest
  install(context: ServerModuleContext): Promise<InstalledServerModule>
}
