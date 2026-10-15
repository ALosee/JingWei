import type { DatabaseConnection } from '@jingwei/database'
import type { UserDeletionReferences } from '@jingwei/module-iam/server/public'

import { PostgresUserDeletionReferences } from '../infrastructure/user-deletion-references.pg.js'

export function createOrganizationUserDeletionReferences(
  connection: DatabaseConnection,
): UserDeletionReferences {
  return new PostgresUserDeletionReferences(connection.view())
}
