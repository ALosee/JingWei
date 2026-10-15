import type { DatabaseConnection } from '@jingwei/database'
import type { RoleDeletionCleanup } from '@jingwei/module-iam/server/public'

import { CleanupRoleNavigation } from '../application/cleanup-role-navigation.js'
import { createNavigationTransaction } from '../infrastructure/navigation-store.pg.js'

export function createNavigationRoleDeletionCleanup(
  connection: DatabaseConnection,
): RoleDeletionCleanup {
  return new CleanupRoleNavigation(createNavigationTransaction(connection))
}
