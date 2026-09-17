export interface OrganizationSnapshot {
  readonly id: string
  readonly name: string
  readonly parentId: string | null
}

/**
 * Cross-module organization query port. Implementations must scope every traversal to `tenantId`,
 * de-duplicate results, and define through tests whether root ids are included in descendants.
 */
export interface OrganizationQuery {
  descendantsOf(tenantId: string, organizationIds: readonly string[]): Promise<readonly string[]>
}

/** Membership facts for data-scope expansion; never exposes internal rows. */
export interface OrganizationMembershipQuery {
  orgUnitIdsOf(tenantId: string, userId: string): Promise<readonly string[]>
  primaryOrgUnitIdOf(tenantId: string, userId: string): Promise<string | null>
}

export {
  createOrganizationManagement,
  createOrganizationQuery,
  createOrganizationSnapshot,
  createOrganizationMembershipQuery,
} from './create-management.js'
export { createOrganizationalScopeFacts } from './create-organizational-scope-facts.js'
export { organizationPermissionRequirements } from './permission-requirements.js'
