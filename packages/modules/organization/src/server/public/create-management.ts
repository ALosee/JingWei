import type { DatabaseRuntime } from '@jingwei/database'
import { toTenantId } from '@jingwei/kernel'
import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { ManageOrganizationUnits } from '../application/manage-org-units.js'
import {
  PostgresOrgUnitStore,
  PostgresOrgUnitOfWork,
  type OrganizationDatabase,
} from '../infrastructure/org-unit-store.pg.js'
import type { OrganizationQuery, OrganizationSnapshot } from './index.js'

/** Public factory; returned use cases still enforce functional RBAC. */
export function createOrganizationManagement(database: DatabaseRuntime, registry: ModuleRegistry) {
  const view = database.view<OrganizationDatabase>()
  return new ManageOrganizationUnits(
    new PostgresOrgUnitStore(view),
    new PostgresOrgUnitOfWork(view),
    createIamAccess(database, registry),
  )
}

/** Root ids are included; empty input returns empty output. */
export function createOrganizationQuery(database: DatabaseRuntime): OrganizationQuery {
  const store = new PostgresOrgUnitStore(database.view<OrganizationDatabase>())
  return {
    async descendantsOf(tenantId: string, organizationIds: readonly string[]) {
      return store.descendantsOf(toTenantId(tenantId), organizationIds)
    },
  }
}

export function createOrganizationSnapshot(database: DatabaseRuntime): {
  find(tenantId: string, id: string): Promise<OrganizationSnapshot | null>
} {
  const store = new PostgresOrgUnitStore(database.view<OrganizationDatabase>())
  return {
    async find(tenantId, id) {
      const unit = await store.get(toTenantId(tenantId), id)
      if (unit === null) return null
      return { id: unit.id, name: unit.name, parentId: unit.parentId }
    },
  }
}
