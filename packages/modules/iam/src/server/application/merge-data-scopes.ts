import type { RoleDataScopeType } from '../../shared/index.js'
import type { DataScopeGrant, OrganizationalScopeFacts } from '../public/authorization.js'

export interface ScopeGrantInput {
  readonly scopeType: RoleDataScopeType
  readonly organizationIds: readonly string[]
}

export class InvalidDataScopeGrantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDataScopeGrantError'
  }
}

const emptyGrant: DataScopeGrant = {
  type: 'CUSTOM',
  organizationIds: [],
  includeSelf: false,
}

/**
 * Union role scopes. Any ALL wins; otherwise org scopes expand via the port and union with SELF.
 * CUSTOM ids are revalidated against the current tenant so stale or forged cross-module ids fail closed.
 */
export async function mergeDataScopes(
  grants: readonly ScopeGrantInput[],
  port: OrganizationalScopeFacts,
  tenantId: string,
  userId: string,
): Promise<DataScopeGrant> {
  if (grants.some((grant) => grant.scopeType === 'ALL'))
    return { type: 'ALL', organizationIds: [], includeSelf: false }

  let includeSelf = false
  let needsMembers = false
  let needsDescendants = false
  const customIds = new Set<string>()

  for (const grant of grants) {
    if (grant.scopeType === 'SELF') includeSelf = true
    else if (grant.scopeType === 'ORGANIZATION') needsMembers = true
    else if (grant.scopeType === 'ORGANIZATION_AND_DESCENDANTS') {
      needsMembers = true
      needsDescendants = true
    } else if (grant.scopeType === 'CUSTOM') {
      for (const id of grant.organizationIds) customIds.add(id)
    }
  }

  const orgIds = new Set<string>()
  if (needsMembers) {
    const members = await port.memberOrgUnitIds(tenantId, userId)
    for (const id of members) orgIds.add(id)
    if (needsDescendants && orgIds.size > 0) {
      const expanded = await port.descendantsOf(tenantId, [...orgIds])
      orgIds.clear()
      for (const id of expanded) orgIds.add(id)
    }
  }
  if (customIds.size > 0) {
    const requestedIds = [...customIds]
    const validIds = new Set(await port.validOrgUnitIds(tenantId, requestedIds))
    if (requestedIds.some((id) => !validIds.has(id)))
      throw new InvalidDataScopeGrantError(
        'CUSTOM data scope contains an unknown organization unit',
      )
    for (const id of requestedIds) orgIds.add(id)
  }

  const organizationIds = [...orgIds].toSorted((left, right) => left.localeCompare(right))

  if (includeSelf && organizationIds.length === 0)
    return { type: 'SELF', organizationIds: [], includeSelf: true }
  if (!includeSelf && organizationIds.length > 0) {
    if (grants.every((grant) => grant.scopeType === 'ORGANIZATION'))
      return { type: 'ORGANIZATION', organizationIds, includeSelf: false }
    if (
      grants.every(
        (grant) =>
          grant.scopeType === 'ORGANIZATION' || grant.scopeType === 'ORGANIZATION_AND_DESCENDANTS',
      ) &&
      grants.some((grant) => grant.scopeType === 'ORGANIZATION_AND_DESCENDANTS')
    )
      return { type: 'ORGANIZATION_AND_DESCENDANTS', organizationIds, includeSelf: false }
    if (grants.every((grant) => grant.scopeType === 'CUSTOM'))
      return { type: 'CUSTOM', organizationIds, includeSelf: false }
  }
  if (organizationIds.length === 0 && !includeSelf) return emptyGrant
  return { type: 'CUSTOM', organizationIds, includeSelf }
}
