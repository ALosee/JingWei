import type { AuthContext } from '@jingwei/kernel'
import type { ScopedPermissionRequirement } from '@jingwei/module-sdk'

export const dataScopeTypes = [
  'ALL',
  'ORGANIZATION',
  'ORGANIZATION_AND_DESCENDANTS',
  'SELF',
  'CUSTOM',
] as const

export type DataScopeType = (typeof dataScopeTypes)[number]

/**
 * Effective data scope after unioning role grants.
 * - `ALL`: no row filter.
 * - `organizationIds`: concrete org units the subject may access (already expanded).
 * - `includeSelf`: rows owned by the current user are also in scope.
 */
export interface DataScopeGrant {
  readonly type: DataScopeType
  readonly organizationIds: readonly string[]
  readonly includeSelf: boolean
}

export interface AuthorizationRequest {
  readonly context: AuthContext
  readonly requirement: ScopedPermissionRequirement
}

/**
 * Public port for data-scoped allow-only RBAC. A successful call always returns an explicit scope;
 * denial throws PERMISSION_DENIED, so null can never be interpreted as ALL by a caller.
 */
export interface AuthorizationEvaluator {
  requireScopedPermission(request: AuthorizationRequest): Promise<DataScopeGrant>
}

/**
 * Organization facts required to expand data scopes. Implemented by Organization module;
 * IAM never imports Organization tables. Missing expansion fails closed to an empty org set.
 */
export interface OrganizationalScopeFacts {
  memberOrgUnitIds(tenantId: string, userId: string): Promise<readonly string[]>
  descendantsOf(tenantId: string, orgUnitIds: readonly string[]): Promise<readonly string[]>
  /** Returns only enabled ids that exist in the requested tenant. */
  validOrgUnitIds(tenantId: string, orgUnitIds: readonly string[]): Promise<readonly string[]>
}
