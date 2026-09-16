import type { DatabaseRuntime } from '@jingwei/database'
import { toTenantId } from '@jingwei/kernel'
import { createAuthorizationEvaluator, createIamAccess } from '@jingwei/module-iam/server/public'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { ManageOrganizationUnits } from '../application/manage-org-units.js'
import { PostgresMembershipStore } from '../infrastructure/membership-store.pg.js'
import {
  PostgresOrgUnitStore,
  PostgresOrgUnitOfWork,
  type OrganizationDatabase,
} from '../infrastructure/org-unit-store.pg.js'
import { createOrganizationalScopeFacts } from './create-organizational-scope-facts.js'
import type {
  OrganizationMembershipQuery,
  OrganizationQuery,
  OrganizationSnapshot,
} from './index.js'

/** Public factory; returned use cases still enforce functional RBAC and data scope. */
export function createOrganizationManagement(database: DatabaseRuntime, registry: ModuleRegistry) {
  const view = database.view<OrganizationDatabase>()
  const evaluator = createAuthorizationEvaluator(
    database,
    registry,
    createOrganizationalScopeFacts(database),
  )
  return new ManageOrganizationUnits(
    new PostgresOrgUnitStore(view),
    new PostgresOrgUnitOfWork(view),
    createIamAccess(database, registry),
    evaluator,
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

/** Membership facts for IAM data-scope expansion; tenant-scoped and free of internal rows. */
export function createOrganizationMembershipQuery(
  database: DatabaseRuntime,
): OrganizationMembershipQuery {
  const store = new PostgresMembershipStore(database.view<OrganizationDatabase>())
  return {
    async orgUnitIdsOf(tenantId: string, userId: string) {
      return store.orgUnitIdsOf(toTenantId(tenantId), userId)
    },
    async primaryOrgUnitIdOf(tenantId: string, userId: string) {
      return store.primaryOrgUnitIdOf(toTenantId(tenantId), userId)
    },
  }
}
