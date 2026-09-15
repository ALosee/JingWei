import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import { toUserId, type ApplicationContext, type TenantId } from '@jingwei/kernel'

import type { ManagedUser, UpdateManagedUser, UserRoleAssignment } from '../../shared/index.js'
import type {
  UserAdminStore,
  UserAdminTransaction,
  UserAdminUnitOfWork,
} from '../application/user-admin-store.js'
import type { UserStatus } from '../domain/user-status.js'
import type { IamDatabase } from './credential-reader.pg.js'

function toManagedUser(row: {
  id: string
  username: string
  display_name: string
  email: string | null
  phone: string | null
  status: UserStatus
  last_login_at: Date | null
  created_at: Date
  role_count?: string | number | bigint
}): ManagedUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    roleCount: Number(row.role_count ?? 0),
  }
}

export class PostgresUserAdminStore implements UserAdminStore {
  constructor(private readonly db: Kysely<IamDatabase>) {}

  async list(tenantId: TenantId): Promise<ManagedUser[]> {
    const rows = await this.db
      .selectFrom('iam.user as user')
      .leftJoin('iam.user_role as userRole', (join) =>
        join.onRef('userRole.user_id', '=', 'user.id').on('userRole.tenant_id', '=', tenantId),
      )
      .select(({ fn }) => [
        'user.id',
        'user.username',
        'user.display_name',
        'user.email',
        'user.phone',
        'user.status',
        'user.last_login_at',
        'user.created_at',
        fn.count<string>('userRole.role_id').as('role_count'),
      ])
      .where('user.tenant_id', '=', tenantId)
      .groupBy([
        'user.id',
        'user.username',
        'user.display_name',
        'user.email',
        'user.phone',
        'user.status',
        'user.last_login_at',
        'user.created_at',
      ])
      .orderBy('user.username')
      .execute()
    return rows.map(toManagedUser)
  }

  async get(tenantId: TenantId, id: string): Promise<ManagedUser | null> {
    const row = await this.db
      .selectFrom('iam.user as user')
      .leftJoin('iam.user_role as userRole', (join) =>
        join.onRef('userRole.user_id', '=', 'user.id').on('userRole.tenant_id', '=', tenantId),
      )
      .select(({ fn }) => [
        'user.id',
        'user.username',
        'user.display_name',
        'user.email',
        'user.phone',
        'user.status',
        'user.last_login_at',
        'user.created_at',
        fn.count<string>('userRole.role_id').as('role_count'),
      ])
      .where('user.tenant_id', '=', tenantId)
      .where('user.id', '=', id)
      .groupBy([
        'user.id',
        'user.username',
        'user.display_name',
        'user.email',
        'user.phone',
        'user.status',
        'user.last_login_at',
        'user.created_at',
      ])
      .executeTakeFirst()
    return row === undefined ? null : toManagedUser(row)
  }

  async usernameTaken(tenantId: TenantId, usernameNormalized: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('iam.user')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('username_normalized', '=', usernameNormalized)
      .executeTakeFirst()
    return row !== undefined
  }

  async emailTaken(
    tenantId: TenantId,
    emailNormalized: string,
    exceptUserId?: string,
  ): Promise<boolean> {
    let query = this.db
      .selectFrom('iam.user')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('email_normalized', '=', emailNormalized)
    if (exceptUserId !== undefined) query = query.where('id', '!=', exceptUserId)
    return (await query.executeTakeFirst()) !== undefined
  }

  private managerQuery(tenantId: TenantId) {
    return this.db
      .selectFrom('iam.user as user')
      .innerJoin('iam.user_role as userRole', 'userRole.user_id', 'user.id')
      .innerJoin('iam.role as role', 'role.id', 'userRole.role_id')
      .innerJoin('iam.role_permission as grant', 'grant.role_id', 'role.id')
      .where('user.tenant_id', '=', tenantId)
      .where('user.status', '=', 'ACTIVE')
      .where('role.tenant_id', '=', tenantId)
      .where('role.status', '=', 'ACTIVE')
      .where('grant.tenant_id', '=', tenantId)
      .where('grant.permission_code', '=', 'iam.user.manage')
  }

  async countOtherActiveManagers(tenantId: TenantId, exceptUserId: string): Promise<number> {
    const row = await this.managerQuery(tenantId)
      .where('user.id', '!=', exceptUserId)
      .select(({ fn }) => fn.count<string>('user.id').distinct().as('manager_count'))
      .executeTakeFirst()
    return Number(row?.manager_count ?? 0)
  }

  async userHasActiveManagePermission(tenantId: TenantId, userId: string): Promise<boolean> {
    const row = await this.managerQuery(tenantId)
      .where('user.id', '=', userId)
      .select('user.id')
      .executeTakeFirst()
    return row !== undefined
  }

  async rolesIncludeManagePermission(
    tenantId: TenantId,
    roleIds: readonly string[],
  ): Promise<boolean> {
    if (roleIds.length === 0) return false
    const row = await this.db
      .selectFrom('iam.role_permission as grant')
      .select('grant.permission_code')
      .where('grant.tenant_id', '=', tenantId)
      .where('grant.role_id', 'in', [...roleIds])
      .where('grant.permission_code', '=', 'iam.user.manage')
      .executeTakeFirst()
    return row !== undefined
  }

  async rolesExist(tenantId: TenantId, roleIds: readonly string[]): Promise<boolean> {
    if (roleIds.length === 0) return true
    const rows = await this.db
      .selectFrom('iam.role')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', 'in', [...roleIds])
      .where('status', '=', 'ACTIVE')
      .execute()
    return rows.length === roleIds.length
  }

  async listUserRoles(tenantId: TenantId, userId: string): Promise<UserRoleAssignment[]> {
    const rows = await this.db
      .selectFrom('iam.user_role as userRole')
      .innerJoin('iam.role as role', 'role.id', 'userRole.role_id')
      .select(['role.id', 'role.code', 'role.name', 'role.status'])
      .where('userRole.tenant_id', '=', tenantId)
      .where('userRole.user_id', '=', userId)
      .where('role.tenant_id', '=', tenantId)
      .orderBy('role.code')
      .execute()
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
    }))
  }

  async insertUser(
    context: ApplicationContext,
    input: {
      readonly id: string
      readonly username: string
      readonly usernameNormalized: string
      readonly displayName: string
      readonly email: string | null
      readonly emailNormalized: string | null
      readonly phone: string | null
      readonly passwordHash: string
      readonly passwordChangedAt: Date
      readonly status: 'ACTIVE' | 'INVITED'
    },
  ): Promise<void> {
    await this.db
      .insertInto('iam.user')
      .values({
        id: input.id,
        tenant_id: context.tenantId,
        username: input.username,
        username_normalized: input.usernameNormalized,
        email: input.email,
        email_normalized: input.emailNormalized,
        phone: input.phone,
        display_name: input.displayName,
        avatar: null,
        status: input.status,
        last_login_at: null,
        created_at: input.passwordChangedAt,
        created_by: toUserId(context.userId),
        updated_at: input.passwordChangedAt,
        updated_by: toUserId(context.userId),
      })
      .execute()
    await this.db
      .insertInto('iam.user_credential')
      .values({
        user_id: input.id,
        password_hash: input.passwordHash,
        password_changed_at: input.passwordChangedAt,
        failed_attempts: 0,
        locked_until: null,
        created_at: input.passwordChangedAt,
        updated_at: input.passwordChangedAt,
      })
      .execute()
  }

  async updateUser(
    context: ApplicationContext,
    id: string,
    patch: UpdateManagedUser & { emailNormalized?: string | null },
  ): Promise<void> {
    await this.db
      .updateTable('iam.user')
      .set({
        ...(patch.displayName === undefined ? {} : { display_name: patch.displayName }),
        ...(patch.email === undefined ? {} : { email: patch.email }),
        ...(patch.emailNormalized === undefined ? {} : { email_normalized: patch.emailNormalized }),
        ...(patch.phone === undefined ? {} : { phone: patch.phone }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        updated_at: new Date(),
        updated_by: toUserId(context.userId),
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .execute()
  }

  async updateUserPassword(
    context: ApplicationContext,
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<void> {
    await this.db
      .updateTable('iam.user_credential')
      .set({
        password_hash: passwordHash,
        password_changed_at: changedAt,
        failed_attempts: 0,
        locked_until: null,
        updated_at: changedAt,
      })
      .where('user_id', '=', userId)
      .execute()
    await this.db
      .updateTable('iam.user')
      .set({ updated_at: changedAt, updated_by: toUserId(context.userId) })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', userId)
      .execute()
  }

  async replaceUserRoles(
    context: ApplicationContext,
    userId: string,
    roleIds: readonly string[],
  ): Promise<void> {
    await this.db
      .deleteFrom('iam.user_role')
      .where('tenant_id', '=', context.tenantId)
      .where('user_id', '=', userId)
      .execute()
    if (roleIds.length === 0) return
    await this.db
      .insertInto('iam.user_role')
      .values(
        roleIds.map((roleId) => ({
          tenant_id: context.tenantId,
          user_id: userId,
          role_id: roleId,
          created_at: new Date(),
          created_by: toUserId(context.userId),
        })),
      )
      .execute()
  }
}

export class PostgresUserAdminUnitOfWork implements UserAdminUnitOfWork {
  constructor(private readonly db: Kysely<IamDatabase>) {}

  run<T>(work: (transaction: UserAdminTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresUserAdminStore(transaction),
        record: async (context, action, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'iam',
            action,
            entityType: 'user',
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
