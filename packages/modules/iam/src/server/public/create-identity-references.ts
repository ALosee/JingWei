import type { DatabaseConnection } from '@jingwei/database'

import { PostgresIamIdentityReferences } from '../infrastructure/identity-references.pg.js'
import type { IamIdentityReferences } from './identity-lifecycle.js'

export function createIamIdentityReferences(connection: DatabaseConnection): IamIdentityReferences {
  return new PostgresIamIdentityReferences(connection.view())
}
