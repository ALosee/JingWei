import type { Kysely } from 'kysely'

import { toTenantId, toUserId } from '@jingwei/kernel'

import type { CurrentUserReader, CurrentUserSnapshot } from '../application/read-current-user.js'
import type { IamDatabase } from './credential-reader.pg.js'

export class PostgresCurrentUserReader implements CurrentUserReader {
  constructor(private readonly database: Kysely<IamDatabase>) {}

  async findActiveById(
    tenantId: CurrentUserSnapshot['tenantId'],
    userId: CurrentUserSnapshot['id'],
  ): Promise<CurrentUserSnapshot | null> {
    const row = await this.database
      .selectFrom('iam.user')
      .select(['id', 'tenant_id', 'display_name', 'avatar'])
      .where('tenant_id', '=', tenantId)
      .where('id', '=', userId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()

    return row === undefined
      ? null
      : {
          id: toUserId(row.id),
          tenantId: toTenantId(row.tenant_id),
          displayName: row.display_name,
          avatarUrl: row.avatar,
        }
  }
}
