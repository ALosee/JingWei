import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  MembershipStore,
  MembershipTransaction,
  MembershipUnitOfWork,
  OrganizationMemberPositionRecord,
  OrganizationMemberRecord,
} from '../application/membership-store.js'
import type { OrganizationDatabase } from './org-unit-store.pg.js'

function toJoinedAt(value: Date | string | null): string | null {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function parseJoinedAt(value: string | null): Date | null {
  if (value === null) return null
  return new Date(`${value}T00:00:00.000Z`)
}

export class PostgresMembershipStore implements MembershipStore {
  constructor(private readonly db: Kysely<OrganizationDatabase>) {}

  async unitExists(tenantId: TenantId, orgUnitId: string) {
    const row = await this.db
      .selectFrom('organization.org_unit')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', orgUnitId)
      .executeTakeFirst()
    return row !== undefined
  }

  async unitStatus(tenantId: TenantId, orgUnitId: string) {
    const row = await this.db
      .selectFrom('organization.org_unit')
      .select('status')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', orgUnitId)
      .executeTakeFirst()
    return row?.status ?? null
  }

  async memberExists(tenantId: TenantId, orgUnitId: string, userId: string) {
    const row = await this.db
      .selectFrom('organization.user_org')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .where('user_id', '=', userId)
      .executeTakeFirst()
    return row !== undefined
  }

  async getMember(tenantId: TenantId, orgUnitId: string, userId: string) {
    const row = await this.db
      .selectFrom('organization.user_org')
      .select(['user_id', 'org_unit_id', 'is_primary', 'joined_at'])
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .where('user_id', '=', userId)
      .executeTakeFirst()
    if (row === undefined) return null
    return {
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      isPrimary: row.is_primary,
      joinedAt: toJoinedAt(row.joined_at),
    }
  }

  async listMembers(tenantId: TenantId, orgUnitId: string) {
    const rows = await this.db
      .selectFrom('organization.user_org')
      .select(['user_id', 'org_unit_id', 'is_primary', 'joined_at'])
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('is_primary', 'desc')
      .orderBy('user_id')
      .execute()
    return rows.map((row) => ({
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      isPrimary: row.is_primary,
      joinedAt: toJoinedAt(row.joined_at),
    }))
  }

  private async listPositions(
    db: Kysely<OrganizationDatabase>,
    tenantId: TenantId,
    orgUnitId: string,
    userId?: string,
  ): Promise<OrganizationMemberPositionRecord[]> {
    let query = db
      .selectFrom('organization.user_position as up')
      .innerJoin('organization.position as p', 'p.id', 'up.position_id')
      .select(['up.user_id', 'up.position_id', 'up.is_primary', 'p.code', 'p.name'])
      .where('up.tenant_id', '=', tenantId)
      .where('p.tenant_id', '=', tenantId)
      .where('p.org_unit_id', '=', orgUnitId)
    if (userId !== undefined) query = query.where('up.user_id', '=', userId)
    const rows = await query.orderBy('p.sort_order').orderBy('p.code').execute()
    return rows.map((row) => ({
      userId: row.user_id,
      positionId: row.position_id,
      code: row.code,
      name: row.name,
      isPrimary: row.is_primary,
    }))
  }

  listMemberPositionsInUnit(tenantId: TenantId, orgUnitId: string) {
    return this.listPositions(this.db, tenantId, orgUnitId)
  }

  listUserPositionsInUnit(tenantId: TenantId, orgUnitId: string, userId: string) {
    return this.listPositions(this.db, tenantId, orgUnitId, userId)
  }

  async enabledPositionIdsInUnit(
    tenantId: TenantId,
    orgUnitId: string,
    positionIds: readonly string[],
  ) {
    if (positionIds.length === 0) return new Set<string>()
    const rows = await this.db
      .selectFrom('organization.position')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'ENABLED')
      .where('id', 'in', [...positionIds])
      .execute()
    return new Set(rows.map((row) => row.id))
  }

  async insertMember(context: ApplicationContext, record: OrganizationMemberRecord) {
    await this.db
      .insertInto('organization.user_org')
      .values({
        tenant_id: context.tenantId,
        user_id: record.userId,
        org_unit_id: record.orgUnitId,
        is_primary: record.isPrimary,
        joined_at: parseJoinedAt(record.joinedAt),
      })
      .execute()
  }

  async updateMember(
    context: ApplicationContext,
    orgUnitId: string,
    userId: string,
    patch: { isPrimary?: boolean; joinedAt?: string | null },
  ) {
    await this.db
      .updateTable('organization.user_org')
      .set({
        ...(patch.isPrimary === undefined ? {} : { is_primary: patch.isPrimary }),
        ...(patch.joinedAt === undefined ? {} : { joined_at: parseJoinedAt(patch.joinedAt) }),
      })
      .where('tenant_id', '=', context.tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .where('user_id', '=', userId)
      .execute()
  }

  async deleteMember(context: ApplicationContext, orgUnitId: string, userId: string) {
    await this.db
      .deleteFrom('organization.user_org')
      .where('tenant_id', '=', context.tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .where('user_id', '=', userId)
      .execute()
  }

  async clearOtherPrimaryOrgs(context: ApplicationContext, userId: string, keepOrgUnitId: string) {
    const demoted = await this.db
      .selectFrom('organization.user_org')
      .select(['user_id', 'org_unit_id', 'is_primary', 'joined_at'])
      .where('tenant_id', '=', context.tenantId)
      .where('user_id', '=', userId)
      .where('org_unit_id', '!=', keepOrgUnitId)
      .where('is_primary', '=', true)
      .execute()
    if (demoted.length === 0) return []
    await this.db
      .updateTable('organization.user_org')
      .set({ is_primary: false })
      .where('tenant_id', '=', context.tenantId)
      .where('user_id', '=', userId)
      .where('org_unit_id', '!=', keepOrgUnitId)
      .where('is_primary', '=', true)
      .execute()
    return demoted.map((row) => ({
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      isPrimary: false,
      joinedAt: toJoinedAt(row.joined_at),
    }))
  }

  async deleteMemberPositionsInUnit(
    context: ApplicationContext,
    orgUnitId: string,
    userId: string,
  ) {
    await this.db
      .deleteFrom('organization.user_position as up')
      .where('up.tenant_id', '=', context.tenantId)
      .where('up.user_id', '=', userId)
      .where(
        'up.position_id',
        'in',
        this.db
          .selectFrom('organization.position')
          .select('id')
          .where('tenant_id', '=', context.tenantId)
          .where('org_unit_id', '=', orgUnitId),
      )
      .execute()
  }

  async replaceMemberPositions(
    context: ApplicationContext,
    orgUnitId: string,
    userId: string,
    assignments: readonly { positionId: string; isPrimary: boolean }[],
  ) {
    await this.deleteMemberPositionsInUnit(context, orgUnitId, userId)
    if (assignments.length === 0) return
    await this.db
      .insertInto('organization.user_position')
      .values(
        assignments.map((assignment) => ({
          tenant_id: context.tenantId,
          user_id: userId,
          position_id: assignment.positionId,
          is_primary: assignment.isPrimary,
        })),
      )
      .execute()
  }

  async clearOtherPrimaryPositions(
    context: ApplicationContext,
    userId: string,
    keepPositionIds: readonly string[],
  ) {
    let selectQuery = this.db
      .selectFrom('organization.user_position as up')
      .innerJoin('organization.position as p', 'p.id', 'up.position_id')
      .select(['up.position_id', 'p.org_unit_id'])
      .where('up.tenant_id', '=', context.tenantId)
      .where('up.user_id', '=', userId)
      .where('up.is_primary', '=', true)
      .where('p.tenant_id', '=', context.tenantId)
    if (keepPositionIds.length > 0)
      selectQuery = selectQuery.where('up.position_id', 'not in', [...keepPositionIds])
    const demoted = await selectQuery.execute()

    let updateQuery = this.db
      .updateTable('organization.user_position')
      .set({ is_primary: false })
      .where('tenant_id', '=', context.tenantId)
      .where('user_id', '=', userId)
      .where('is_primary', '=', true)
    if (keepPositionIds.length > 0)
      updateQuery = updateQuery.where('position_id', 'not in', [...keepPositionIds])
    await updateQuery.execute()

    return demoted.map((row) => ({
      positionId: row.position_id,
      orgUnitId: row.org_unit_id,
    }))
  }

  async orgUnitIdsOf(tenantId: TenantId, userId: string) {
    const rows = await this.db
      .selectFrom('organization.user_org')
      .select('org_unit_id')
      .where('tenant_id', '=', tenantId)
      .where('user_id', '=', userId)
      .execute()
    return rows.map((row) => row.org_unit_id)
  }

  async primaryOrgUnitIdOf(tenantId: TenantId, userId: string) {
    const row = await this.db
      .selectFrom('organization.user_org')
      .select('org_unit_id')
      .where('tenant_id', '=', tenantId)
      .where('user_id', '=', userId)
      .where('is_primary', '=', true)
      .executeTakeFirst()
    return row?.org_unit_id ?? null
  }
}

export class PostgresMembershipUnitOfWork implements MembershipUnitOfWork {
  constructor(private readonly db: Kysely<OrganizationDatabase>) {}

  run<T>(work: (transaction: MembershipTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresMembershipStore(transaction),
        record: async (context, action, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'organization',
            action,
            entityType: 'user_org',
            entityId,
            result: 'SUCCESS',
            before,
            after,
          })
        },
      }),
    )
  }
}
