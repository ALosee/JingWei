import type { DatabaseRuntime } from '@jingwei/database'
import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { ManageDictionary } from '../application/manage-dictionary.js'
import {
  PostgresDictionaryStore,
  PostgresDictionaryUnitOfWork,
  type DictionaryDatabase,
} from '../infrastructure/dictionary-store.pg.js'

/**
 * Controlled assembly for seeds and tools. Callers still supply an AuthContext
 * that has passed IAM authorization; this does not bypass permission checks.
 */
export function createDictionaryManagement(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
): ManageDictionary {
  const view = database.view<DictionaryDatabase>()
  return new ManageDictionary(
    new PostgresDictionaryStore(view),
    new PostgresDictionaryUnitOfWork(view),
    createIamAccess(database, registry),
  )
}
