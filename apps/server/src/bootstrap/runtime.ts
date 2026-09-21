import { PostgresSessionRepository, SessionService, type AuthDatabase } from '@jingwei/auth'
import { loadConfig, type AppConfig } from '@jingwei/config'
import {
  createOperatorSessionService,
  type OperatorSessionService,
} from '@jingwei/control-plane/server'
import { DatabaseRuntime } from '@jingwei/database'
import { systemClock } from '@jingwei/kernel'
import { ModuleRegistry } from '@jingwei/module-sdk'
import type { ServerModuleContext } from '@jingwei/module-sdk/server'
import { createLogger, type AppLogger } from '@jingwei/observability'
import { PostgresTenantDirectory, type TenantDirectory } from '@jingwei/tenancy'

import { generatedEdition } from '../generated/edition.js'

export interface Runtime extends ServerModuleContext {
  readonly config: AppConfig
  readonly database: DatabaseRuntime
  readonly logger: AppLogger
  readonly moduleRegistry: ModuleRegistry
  readonly sessionService: SessionService
  readonly operatorSessionService: OperatorSessionService
  readonly tenantDirectory: TenantDirectory
  dispose(): Promise<void>
}

/**
 * Creates all process-scoped platform resources for the generated Edition.
 *
 * Passing an explicit environment keeps startup tests isolated from global `process.env`. The
 * caller owns the returned runtime and must invoke `dispose()` during shutdown or failed startup.
 */
export function createRuntime(environment: NodeJS.ProcessEnv = process.env): Runtime {
  const config = loadConfig(environment)
  const database = new DatabaseRuntime(config.databaseUrl)
  const logger = createLogger({ environment: config.environment })
  const tenantDirectory = new PostgresTenantDirectory(database.view())
  const sessionRepository = new PostgresSessionRepository(database.view<AuthDatabase>())
  const sessionService = new SessionService(
    sessionRepository,
    systemClock,
    config.session,
    tenantDirectory,
  )
  const operatorSessionService = createOperatorSessionService(database, config)

  return {
    config,
    database,
    logger,
    moduleRegistry: new ModuleRegistry(generatedEdition),
    sessionService,
    operatorSessionService,
    tenantDirectory,
    dispose: () => database.dispose(),
  }
}
