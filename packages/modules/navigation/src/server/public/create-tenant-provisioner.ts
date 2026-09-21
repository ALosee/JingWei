import type { DatabaseRuntime } from '@jingwei/database'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { ProvisionTenantNavigation } from '../application/provision-tenant-navigation.js'
import type { NavigationDatabase } from '../infrastructure/navigation-store.pg.js'
import { PostgresTenantNavigationProvisioningUnitOfWork } from '../infrastructure/tenant-provisioning.pg.js'

export function createTenantNavigationProvisioner(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
): ProvisionTenantNavigation {
  return new ProvisionTenantNavigation(
    new PostgresTenantNavigationProvisioningUnitOfWork(database.view<NavigationDatabase>()),
    registry,
  )
}
