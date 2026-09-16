import type { Kysely } from 'kysely'

import type { TenantId } from '@jingwei/kernel'

import type {
  IamUserDirectory,
  IamUserSafeProfile,
  IamUserDirectoryStatus,
} from '../public/user-directory.js'

interface UserDirectoryDatabase {
  'iam.user': {
    id: string
    tenant_id: string
    username: string
    display_name: string
    avatar: string | null
    status: IamUserDirectoryStatus
  }
}

export class PostgresIamUserDirectory implements IamUserDirectory {
  constructor(private readonly database: Kysely<UserDirectoryDatabase>) {}

  async findSafeProfiles(tenantId: TenantId, userIds: readonly string[]) {
    if (userIds.length === 0) return [] as readonly IamUserSafeProfile[]
    const rows = await this.database
      .selectFrom('iam.user')
      .select(['id', 'username', 'display_name', 'avatar', 'status'])
      .where('tenant_id', '=', tenantId)
      .where('id', 'in', [...userIds])
      .orderBy('username')
      .execute()
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      status: row.status,
      avatar: row.avatar,
    }))
  }

  async usersExist(tenantId: TenantId, userIds: readonly string[]) {
    if (userIds.length === 0) return new Set<string>()
    const rows = await this.database
      .selectFrom('iam.user')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', 'in', [...userIds])
      .execute()
    return new Set(rows.map((row) => row.id))
  }

  async listSafeProfiles(tenantId: TenantId, options?: { status?: IamUserDirectoryStatus }) {
    let query = this.database
      .selectFrom('iam.user')
      .select(['id', 'username', 'display_name', 'avatar', 'status'])
      .where('tenant_id', '=', tenantId)
    if (options?.status !== undefined) query = query.where('status', '=', options.status)
    const rows = await query.orderBy('username').limit(2_000).execute()
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      status: row.status,
      avatar: row.avatar,
    }))
  }
}
