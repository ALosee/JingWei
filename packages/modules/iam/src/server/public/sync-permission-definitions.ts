import type { DatabaseRuntime } from '@jingwei/database'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import type { IamDatabase } from '../infrastructure/credential-reader.pg.js'
import { syncPermissionDefinitions } from '../infrastructure/permission-projection.pg.js'

/** Operational projection of the current Edition permission manifest into IAM-owned storage. */
export function syncIamPermissionDefinitions(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
): Promise<void> {
  return syncPermissionDefinitions(database.view<IamDatabase>(), registry)
}
