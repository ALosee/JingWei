import type { ApplicationContext, TenantId } from '@jingwei/kernel'

export interface OrganizationMemberRecord {
  readonly userId: string
  readonly orgUnitId: string
  readonly isPrimary: boolean
  readonly joinedAt: string | null
}

export interface OrganizationMemberPositionRecord {
  readonly userId: string
  readonly positionId: string
  readonly code: string
  readonly name: string
  readonly isPrimary: boolean
}

export interface MembershipStore {
  unitExists(tenantId: TenantId, orgUnitId: string): Promise<boolean>
  unitStatus(tenantId: TenantId, orgUnitId: string): Promise<'ENABLED' | 'DISABLED' | null>
  memberExists(tenantId: TenantId, orgUnitId: string, userId: string): Promise<boolean>
  getMember(
    tenantId: TenantId,
    orgUnitId: string,
    userId: string,
  ): Promise<OrganizationMemberRecord | null>
  listMembers(tenantId: TenantId, orgUnitId: string): Promise<OrganizationMemberRecord[]>
  listMemberPositionsInUnit(
    tenantId: TenantId,
    orgUnitId: string,
  ): Promise<OrganizationMemberPositionRecord[]>
  listUserPositionsInUnit(
    tenantId: TenantId,
    orgUnitId: string,
    userId: string,
  ): Promise<OrganizationMemberPositionRecord[]>
  enabledPositionIdsInUnit(
    tenantId: TenantId,
    orgUnitId: string,
    positionIds: readonly string[],
  ): Promise<ReadonlySet<string>>
  insertMember(context: ApplicationContext, record: OrganizationMemberRecord): Promise<void>
  updateMember(
    context: ApplicationContext,
    orgUnitId: string,
    userId: string,
    patch: { isPrimary?: boolean; joinedAt?: string | null },
  ): Promise<void>
  deleteMember(context: ApplicationContext, orgUnitId: string, userId: string): Promise<void>
  /** Clears other primary orgs and returns the demoted records for audit. */
  clearOtherPrimaryOrgs(
    context: ApplicationContext,
    userId: string,
    keepOrgUnitId: string,
  ): Promise<readonly OrganizationMemberRecord[]>
  deleteMemberPositionsInUnit(
    context: ApplicationContext,
    orgUnitId: string,
    userId: string,
  ): Promise<void>
  replaceMemberPositions(
    context: ApplicationContext,
    orgUnitId: string,
    userId: string,
    assignments: readonly { positionId: string; isPrimary: boolean }[],
  ): Promise<void>
  /** Clears primary flags outside keepPositionIds and returns demoted rows with owning org. */
  clearOtherPrimaryPositions(
    context: ApplicationContext,
    userId: string,
    keepPositionIds: readonly string[],
  ): Promise<readonly { positionId: string; orgUnitId: string }[]>
  orgUnitIdsOf(tenantId: TenantId, userId: string): Promise<readonly string[]>
  primaryOrgUnitIdOf(tenantId: TenantId, userId: string): Promise<string | null>
}

export interface MembershipTransaction {
  store: MembershipStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface MembershipUnitOfWork {
  run<T>(work: (transaction: MembershipTransaction) => Promise<T>): Promise<T>
}
