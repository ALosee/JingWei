import type { DatabaseRuntime } from '@jingwei/database'
import { toTenantId } from '@jingwei/kernel'
import type { OrganizationalScopeFacts } from '@jingwei/module-iam/server/public'

import { PostgresMembershipStore } from '../infrastructure/membership-store.pg.js'
import {
  PostgresOrgUnitStore,
  type OrganizationDatabase,
} from '../infrastructure/org-unit-store.pg.js'

/** Organization-owned adapter for IAM's consumer-defined organizational facts contract. */
export function createOrganizationalScopeFacts(
  database: DatabaseRuntime,
): OrganizationalScopeFacts {
  const view = database.view<OrganizationDatabase>()
  const membership = new PostgresMembershipStore(view)
  const units = new PostgresOrgUnitStore(view)
  return {
    async memberOrgUnitIds(tenantId: string, userId: string) {
      const scopedTenantId = toTenantId(tenantId)
      const ids = await membership.orgUnitIdsOf(scopedTenantId, userId)
      return units.validIds(scopedTenantId, ids)
    },
    async descendantsOf(tenantId: string, orgUnitIds: readonly string[]) {
      return units.descendantsOf(toTenantId(tenantId), orgUnitIds)
    },
    async validOrgUnitIds(tenantId: string, orgUnitIds: readonly string[]) {
      return units.validIds(toTenantId(tenantId), orgUnitIds)
    },
  }
}
