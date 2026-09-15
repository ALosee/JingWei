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

export {
  createOrganizationManagement,
  createOrganizationQuery,
  createOrganizationSnapshot,
} from './create-management.js'
