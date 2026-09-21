import { Argon2idPasswordHasher } from '@jingwei/auth'
import type { DatabaseRuntime } from '@jingwei/database'
import { systemClock } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { ProvisionTenantIam } from '../application/provision-tenant.js'
import { type IamDatabase } from '../infrastructure/credential-reader.pg.js'
import { PostgresTenantIamProvisioningStore } from '../infrastructure/tenant-provisioning-store.pg.js'

export function createTenantIamProvisioner(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
): ProvisionTenantIam {
  return new ProvisionTenantIam(
    new PostgresTenantIamProvisioningStore(database.view<IamDatabase>()),
    registry,
    new Argon2idPasswordHasher(),
    systemClock,
  )
}
