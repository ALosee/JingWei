import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  CreateIamRole,
  IamRole,
  RoleDataScopeType,
  RolePermissionGrant,
  RoleStatus,
  UpdateIamRole,
} from '../../shared/index.js'
import type { RoleStore, RoleTransaction, RoleUnitOfWork } from '../application/role-store.js'
import type { IamDatabase } from './credential-reader.pg.js'

export type RoleDatabase = IamDatabase

function toRole(row: {
  id: string
  code: string
  name: string
  description: string | null
  status: RoleStatus
  is_system: boolean
  created_at: Date
  updated_at: Date
  assignment_count?: string | number | bigint
}): IamRole {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    isSystem: row.is_system,
    assignmentCount: Number(row.assignment_count ?? 0),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresRoleStore implements RoleStore {
  constructor(private readonly db: Kysely<RoleDatabase>) {}

  async list(tenantId: TenantId): Promise<IamRole[]> {
    const rows = await this.db
      .selectFrom('iam.role as role')
      .leftJoin('iam.user_role as userRole', (join) =>
        join.onRef('userRole.role_id', '=', 'role.id').on('userRole.tenant_id', '=', tenantId),
      )
      .select(({ fn }) => [
        'role.id',
        'role.code',
        'role.name',
        'role.description',
        'role.status',
        'role.is_system',
        'role.created_at',
        'role.updated_at',
        fn.count<string>('userRole.user_id').as('assignment_count'),
      ])
      .where('role.tenant_id', '=', tenantId)
      .groupBy([
        'role.id',
        'role.code',
        'role.name',
        'role.description',
        'role.status',
        'role.is_system',
        'role.created_at',
        'role.updated_at',
      ])
      .orderBy('role.code')
      .execute()
    return rows.map(toRole)
  }

  async get(tenantId: TenantId, id: string): Promise<IamRole | null> {
    const row = await this.db
      .selectFrom('iam.role as role')
      .leftJoin('iam.user_role as userRole', (join) =>
        join.onRef('userRole.role_id', '=', 'role.id').on('userRole.tenant_id', '=', tenantId),
      )
      .select(({ fn }) => [
        'role.id',
        'role.code',
        'role.name',
        'role.description',
        'role.status',
        'role.is_system',
        'role.created_at',
        'role.updated_at',
        fn.count<string>('userRole.user_id').as('assignment_count'),
      ])
      .where('role.tenant_id', '=', tenantId)
      .where('role.id', '=', id)
      .groupBy([
        'role.id',
        'role.code',
        'role.name',
        'role.description',
        'role.status',
        'role.is_system',
        'role.created_at',
        'role.updated_at',
      ])
      .executeTakeFirst()
    return row === undefined ? null : toRole(row)
  }

  async codeTaken(tenantId: TenantId, code: string, exceptId?: string): Promise<boolean> {
    let query = this.db
      .selectFrom('iam.role')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('code', '=', code)
    if (exceptId !== undefined) query = query.where('id', '!=', exceptId)
    return (await query.executeTakeFirst()) !== undefined
  }

  async hasAssignments(tenantId: TenantId, id: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('iam.user_role')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('role_id', '=', id)
      .executeTakeFirst()
    return row !== undefined
  }

  async insert(context: ApplicationContext, role: IamRole): Promise<void> {
    await this.db
      .insertInto('iam.role')
      .values({
        id: role.id,
        tenant_id: context.tenantId,
        code: role.code,
        name: role.name,
        description: role.description,
        status: role.status,
        is_system: role.isSystem,
        is_super: false,
        created_at: new Date(role.createdAt),
        created_by: context.userId,
        updated_at: new Date(role.updatedAt),
        updated_by: context.userId,
      })
      .execute()
  }

  async update(context: ApplicationContext, id: string, patch: UpdateIamRole): Promise<void> {
    await this.db
      .updateTable('iam.role')
      .set({
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.description === undefined ? {} : { description: patch.description }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        updated_at: new Date(),
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }

  async delete(context: ApplicationContext, id: string): Promise<void> {
    // role_permission cascades via FK; org_scope has no FK and must be cleaned explicitly.
    await this.db
      .deleteFrom('iam.role_permission_org_scope')
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', '=', id)
      .execute()
    await this.db
      .deleteFrom('iam.role')
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }

  async listGrants(tenantId: TenantId, roleId: string): Promise<RolePermissionGrant[]> {
    const rows = await this.db
      .selectFrom('iam.role_permission')
      .select(['permission_code', 'scope_type'])
      .where('tenant_id', '=', tenantId)
      .where('role_id', '=', roleId)
      .orderBy('permission_code')
      .execute()
    if (rows.length === 0) return []
    const customRows = await this.db
      .selectFrom('iam.role_permission_org_scope')
      .select(['permission_code', 'org_unit_id'])
      .where('tenant_id', '=', tenantId)
      .where('role_id', '=', roleId)
      .execute()
    const customByPermission = new Map<string, string[]>()
    for (const row of customRows) {
      const bucket = customByPermission.get(row.permission_code)
      if (bucket === undefined) customByPermission.set(row.permission_code, [row.org_unit_id])
      else bucket.push(row.org_unit_id)
    }
    return rows.map((row) => {
      const scopeType = row.scope_type as RoleDataScopeType
      const organizationIds = customByPermission.get(row.permission_code)
      return {
        permissionCode: row.permission_code,
        scopeType,
        ...(scopeType === 'CUSTOM' && organizationIds !== undefined
          ? { organizationIds: organizationIds.toSorted((a, b) => a.localeCompare(b)) }
          : {}),
      }
    })
  }

  async replaceGrants(
    context: ApplicationContext,
    roleId: string,
    grants: readonly RolePermissionGrant[],
  ): Promise<void> {
    await this.db
      .deleteFrom('iam.role_permission_org_scope')
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', '=', roleId)
      .execute()
    await this.db
      .deleteFrom('iam.role_permission')
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', '=', roleId)
      .execute()
    if (grants.length === 0) return
    await this.db
      .insertInto('iam.role_permission')
      .values(
        grants.map((grant) => ({
          tenant_id: context.tenantId,
          role_id: roleId,
          permission_code: grant.permissionCode,
          scope_type: grant.scopeType,
          created_at: new Date(),
          created_by: context.userId,
        })),
      )
      .execute()
    const orgScopeRows = grants.flatMap((grant) =>
      grant.scopeType === 'CUSTOM'
        ? (grant.organizationIds ?? []).map((orgUnitId) => ({
            tenant_id: context.tenantId,
            role_id: roleId,
            permission_code: grant.permissionCode,
            org_unit_id: orgUnitId,
          }))
        : [],
    )
    if (orgScopeRows.length > 0)
      await this.db.insertInto('iam.role_permission_org_scope').values(orgScopeRows).execute()
  }
}

export class PostgresRoleUnitOfWork implements RoleUnitOfWork {
  constructor(private readonly db: Kysely<RoleDatabase>) {}

  run<T>(work: (transaction: RoleTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresRoleStore(transaction),
        record: async (context, action, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'iam',
            action,
            entityType: 'role',
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

export type { CreateIamRole }
