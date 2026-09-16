import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  CreateOrganizationUnit,
  OrganizationUnit,
  OrganizationUnitStatus,
  OrganizationType,
  UpdateOrganizationUnit,
} from '../../shared/index.js'
import type {
  OrgUnitStore,
  OrgUnitOfWork,
  OrgUnitTransaction,
} from '../application/org-unit-store.js'

interface OrgUnitRow {
  id: string
  tenant_id: string
  parent_id: string | null
  code: string
  name: string
  type: OrganizationType
  status: OrganizationUnitStatus
  sort_order: number
  created_at: Date
  created_by: string | null
  updated_at: Date
  updated_by: string | null
}

export interface OrganizationDatabase {
  'organization.org_unit': OrgUnitRow
  'organization.user_org': {
    tenant_id: string
    user_id: string
    org_unit_id: string
    is_primary: boolean
    joined_at: Date | null
  }
  'organization.position': {
    id: string
    tenant_id: string
    org_unit_id: string
    code: string
    name: string
    status: OrganizationUnitStatus
    sort_order: number
  }
  'organization.user_position': {
    tenant_id: string
    user_id: string
    position_id: string
    is_primary: boolean
  }
}

function toUnit(row: OrgUnitRow): OrganizationUnit {
  return {
    id: row.id,
    parentId: row.parent_id,
    code: row.code,
    name: row.name,
    type: row.type,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresOrgUnitStore implements OrgUnitStore {
  constructor(private readonly db: Kysely<OrganizationDatabase>) {}

  async list(tenantId: TenantId) {
    const rows = await this.db
      .selectFrom('organization.org_unit')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .orderBy('sort_order')
      .orderBy('code')
      .execute()
    return rows.map(toUnit)
  }

  async listVisibleTree(tenantId: TenantId, organizationIds: readonly string[]) {
    if (organizationIds.length === 0) return []
    const rows = await this.db
      .withRecursive('visible_org_tree', (db) =>
        db
          .selectFrom('organization.org_unit')
          .select(['id', 'parent_id'])
          .where('tenant_id', '=', tenantId)
          .where('id', 'in', [...organizationIds])
          .union((eb) =>
            eb
              .selectFrom('organization.org_unit as parent')
              .innerJoin('visible_org_tree as child', 'child.parent_id', 'parent.id')
              .select(['parent.id', 'parent.parent_id'])
              .where('parent.tenant_id', '=', tenantId),
          ),
      )
      .selectFrom('organization.org_unit as unit')
      .innerJoin('visible_org_tree as visible', 'visible.id', 'unit.id')
      .selectAll('unit')
      .where('unit.tenant_id', '=', tenantId)
      .orderBy('unit.sort_order')
      .orderBy('unit.code')
      .execute()
    return rows.map(toUnit)
  }

  async get(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.org_unit')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
      .executeTakeFirst()
    return row === undefined ? null : toUnit(row)
  }

  async exists(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.org_unit')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
      .executeTakeFirst()
    return row !== undefined
  }

  async validIds(tenantId: TenantId, ids: readonly string[]) {
    if (ids.length === 0) return []
    const rows = await this.db
      .selectFrom('organization.org_unit')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', 'in', [...ids])
      .where('status', '=', 'ENABLED')
      .execute()
    return rows.map((row) => row.id)
  }

  async codeTaken(tenantId: TenantId, code: string, exceptId?: string) {
    let query = this.db
      .selectFrom('organization.org_unit')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('code', '=', code)
    if (exceptId !== undefined) query = query.where('id', '!=', exceptId)
    return (await query.executeTakeFirst()) !== undefined
  }

  async hasChildren(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.org_unit')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('parent_id', '=', id)
      .executeTakeFirst()
    return row !== undefined
  }

  async hasMembers(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.user_org')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', id)
      .executeTakeFirst()
    return row !== undefined
  }

  async hasPositions(tenantId: TenantId, id: string) {
    const row = await this.db
      .selectFrom('organization.position')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('org_unit_id', '=', id)
      .executeTakeFirst()
    return row !== undefined
  }

  /** True when candidate is strictly below rootId. Self is not a descendant. */
  async isDescendant(tenantId: TenantId, rootId: string, candidateId: string) {
    const result = await this.db
      .withRecursive('descendants', (db) =>
        db
          .selectFrom('organization.org_unit')
          .select('id')
          .where('tenant_id', '=', tenantId)
          .where('parent_id', '=', rootId)
          .union((eb) =>
            eb
              .selectFrom('organization.org_unit as unit')
              .innerJoin('descendants as d', 'd.id', 'unit.parent_id')
              .select('unit.id')
              .where('unit.tenant_id', '=', tenantId),
          ),
      )
      .selectFrom('descendants')
      .select('id')
      .where('id', '=', candidateId)
      .executeTakeFirst()
    return result !== undefined
  }

  async insert(context: ApplicationContext, value: OrganizationUnit) {
    await this.db
      .insertInto('organization.org_unit')
      .values({
        id: value.id,
        tenant_id: context.tenantId,
        parent_id: value.parentId,
        code: value.code,
        name: value.name,
        type: value.type,
        status: value.status,
        sort_order: value.sortOrder,
        created_at: new Date(value.createdAt),
        created_by: context.userId,
        updated_at: new Date(value.updatedAt),
        updated_by: context.userId,
      })
      .execute()
  }

  async update(
    context: ApplicationContext,
    id: string,
    patch: UpdateOrganizationUnit & { updatedAt: Date },
  ) {
    await this.db
      .updateTable('organization.org_unit')
      .set({
        ...(patch.parentId === undefined ? {} : { parent_id: patch.parentId }),
        ...(patch.code === undefined ? {} : { code: patch.code }),
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.type === undefined ? {} : { type: patch.type }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.sortOrder === undefined ? {} : { sort_order: patch.sortOrder }),
        updated_at: patch.updatedAt,
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }

  async delete(context: ApplicationContext, id: string) {
    await this.db
      .deleteFrom('organization.org_unit')
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }

  /** Root ids included in the result; empty input yields empty output. */
  async descendantsOf(tenantId: TenantId, organizationIds: readonly string[]) {
    if (organizationIds.length === 0) return []
    const rows = await this.db
      .withRecursive('org_tree', (db) =>
        db
          .selectFrom('organization.org_unit')
          .select('id')
          .where('tenant_id', '=', tenantId)
          .where('id', 'in', [...organizationIds])
          .union((eb) =>
            eb
              .selectFrom('organization.org_unit as unit')
              .innerJoin('org_tree as t', 't.id', 'unit.parent_id')
              .select('unit.id')
              .where('unit.tenant_id', '=', tenantId),
          ),
      )
      .selectFrom('org_tree')
      .select('id')
      .execute()
    return rows.map((row) => row.id)
  }
}

export class PostgresOrgUnitOfWork implements OrgUnitOfWork {
  constructor(private readonly db: Kysely<OrganizationDatabase>) {}

  run<T>(work: (transaction: OrgUnitTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresOrgUnitStore(transaction),
        record: async (context, action, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'organization',
            action,
            entityType: 'org_unit',
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

export type { CreateOrganizationUnit }
