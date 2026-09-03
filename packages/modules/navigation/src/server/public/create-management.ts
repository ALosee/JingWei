import type { DatabaseRuntime } from '@jingwei/database'
import type { ModuleRegistry } from '@jingwei/module-sdk'
import { createIamAccess } from '@jingwei/module-iam/server/public'
import { ManageNavigation } from '../application/manage-navigation.js'
import { PostgresNavigationStore, PostgresNavigationUnitOfWork, type NavigationDatabase } from '../infrastructure/navigation-store.pg.js'

/** Public factory for controlled initialization; returned use cases still enforce functional RBAC. */
export function createNavigationManagement(database: DatabaseRuntime, registry: ModuleRegistry) {
  const view = database.view<NavigationDatabase>()
  return new ManageNavigation(new PostgresNavigationStore(view), new PostgresNavigationUnitOfWork(view), registry, createIamAccess(database, registry))
}
