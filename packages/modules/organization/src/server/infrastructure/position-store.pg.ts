import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  CreateOrganizationPosition,
  OrganizationPosition,
  OrganizationUnitStatus,
  UpdateOrganizationPosition,
} from '../../shared/index.js'
import type {
  PositionStore,
  PositionUnitOfWork,
  PositionTransaction,
} from '../application/position-store.js'
import type { OrganizationDatabase } from './org-unit-store.pg.js'

interface PositionRow {
  id: string
  tenant_id: string
  org_unit_id: string
  code: string
  name: string
  status: OrganizationUnitStatus
  sort_order: number
}

function toPosition(row: PositionRow): OrganizationPosition {
  return {
    id: row.id,
    orgUnitId: row.org_unit_id,
    code: row.code,
    name: row.name,
    status: row.status,
    sortOrder: row.sort_order,
  }
}

export class PostgresPositionStore implements PositionStore {
  constructor(private readonly db: Kysely<OrganizationDatabase>) {}

  async listByUnit(tenantId: TenantId, orgUnitId: string) {
    const rows = await this.db
      .selectFrom('organization.position')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('sort_order')
      .orderBy('code')
      .execute()
    return rows.map(toPosition)
  }

  async get(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.position')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
      .executeTakeFirst()
    return row === undefined ? null : toPosition(row)
  }

  async unitExists(tenantId: TenantId, orgUnitId: string) {
    const row = await this.db
      .selectFrom('organization.org_unit')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', orgUnitId)
      .executeTakeFirst()
    return row !== undefined
  }

  async codeTaken(tenantId: TenantId, orgUnitId: string, code: string, exceptId?: string) {
    let query = this.db
      .selectFrom('organization.position')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', orgUnitId)
      .where('code', '=', code)
    if (exceptId !== undefined) query = query.where('id', '!=', exceptId)
    return (await query.executeTakeFirst()) !== undefined
  }

  async hasMembers(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.user_position')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('position_id', '=', id)
      .executeTakeFirst()
    return row !== undefined
  }

  async insert(context: ApplicationContext, position: OrganizationPosition) {
    await this.db
      .insertInto('organization.position')
      .values({
        id: position.id,
        tenant_id: context.tenantId,
        org_unit_id: position.orgUnitId,
        code: position.code,
        name: position.name,
        status: position.status,
        sort_order: position.sortOrder,
      })
      .execute()
  }

  async update(context: ApplicationContext, id: string, patch: UpdateOrganizationPosition) {
    await this.db
      .updateTable('organization.position')
      .set({
        ...(patch.code === undefined ? {} : { code: patch.code }),
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.sortOrder === undefined ? {} : { sort_order: patch.sortOrder }),
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }

  async delete(context: ApplicationContext, id: string) {
    await this.db
      .deleteFrom('organization.position')
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }
}

export class PostgresPositionUnitOfWork implements PositionUnitOfWork {
  constructor(private readonly db: Kysely<OrganizationDatabase>) {}

  run<T>(work: (transaction: PositionTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresPositionStore(transaction),
        record: async (context, action, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'organization',
            action,
            entityType: 'position',
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

export type { CreateOrganizationPosition }
