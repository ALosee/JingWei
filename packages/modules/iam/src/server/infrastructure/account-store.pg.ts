import type { Kysely } from 'kysely'

import { toUserId, type TenantId, type UserId } from '@jingwei/kernel'

import type { AccountProfileReader, AccountProfileWriter } from '../application/account-profile.js'
import type { IamDatabase } from './credential-reader.pg.js'

export class PostgresAccountStore implements AccountProfileReader, AccountProfileWriter {
  constructor(private readonly database: Kysely<IamDatabase>) {}

  async findProfile(tenantId: TenantId, userId: UserId) {
    const row = await this.database
      .selectFrom('iam.user as user')
      .innerJoin('iam.user_credential as credential', 'credential.user_id', 'user.id')
      .select([
        'user.id',
        'user.username',
        'user.display_name',
        'user.email',
        'user.phone',
        'user.avatar',
        'user.status',
        'user.last_login_at',
        'user.created_at',
        'credential.password_changed_at',
        'credential.password_hash',
      ])
      .where('user.tenant_id', '=', tenantId)
      .where('user.id', '=', userId)
      .executeTakeFirst()

    if (row === undefined) return null
    return {
      id: toUserId(row.id),
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar,
      status: row.status,
      lastLoginAt: row.last_login_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      passwordChangedAt: row.password_changed_at.toISOString(),
      passwordHash: row.password_hash,
    }
  }

  async listActiveRoles(tenantId: TenantId, userId: UserId) {
    const rows = await this.database
      .selectFrom('iam.user_role as userRole')
      .innerJoin('iam.role as role', 'role.id', 'userRole.role_id')
      .select(['role.code', 'role.name', 'role.status'])
      .where('userRole.tenant_id', '=', tenantId)
      .where('userRole.user_id', '=', userId)
      .where('role.status', '=', 'ACTIVE')
      .orderBy('role.code')
      .execute()

    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      status: row.status,
    }))
  }

  async updateProfile(input: {
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly displayName?: string
    readonly avatarUrl?: string | null
    readonly updatedAt: Date
  }): Promise<void> {
    const patch: { display_name?: string; avatar?: string | null; updated_at: Date } = {
      updated_at: input.updatedAt,
    }
    if (input.displayName !== undefined) patch.display_name = input.displayName
    if (input.avatarUrl !== undefined) patch.avatar = input.avatarUrl

    await this.database
      .updateTable('iam.user')
      .set(patch)
      .where('tenant_id', '=', input.tenantId)
      .where('id', '=', input.userId)
      .executeTakeFirstOrThrow()
  }

  async updatePassword(input: {
    readonly userId: UserId
    readonly passwordHash: string
    readonly changedAt: Date
  }): Promise<void> {
    await this.database
      .updateTable('iam.user_credential')
      .set({
        password_hash: input.passwordHash,
        password_changed_at: input.changedAt,
        failed_attempts: 0,
        locked_until: null,
        updated_at: input.changedAt,
      })
      .where('user_id', '=', input.userId)
      .executeTakeFirstOrThrow()
  }
}
