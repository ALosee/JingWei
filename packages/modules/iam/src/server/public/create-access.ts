import type { DatabaseRuntime } from '@jingwei/database'
import type { ModuleRegistry } from '@jingwei/module-sdk'
import type { AppLogger } from '@jingwei/observability'

import { PostgresIamAccess } from '../infrastructure/navigation-access.pg.js'
import type { IamAccess } from './navigation-access.js'

/** Explicit module-owned factory; consumers receive only the IAM public port. */
export function createIamAccess(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
  logger?: AppLogger,
): IamAccess {
  return new PostgresIamAccess(database.view(), registry, logger)
}
