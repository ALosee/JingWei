import type { DatabaseRuntime } from '@jingwei/database'

import { PostgresIamUserDirectory } from '../infrastructure/user-directory.pg.js'
import type { IamUserDirectory } from './user-directory.js'

/** Explicit module-owned factory for cross-module safe user lookup. */
export function createIamUserDirectory(database: DatabaseRuntime): IamUserDirectory {
  return new PostgresIamUserDirectory(database.view())
}
