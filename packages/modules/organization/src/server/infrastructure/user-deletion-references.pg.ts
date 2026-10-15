import type { QueryCreator } from 'kysely'

import type { TenantId } from '@jingwei/kernel'
import type { UserDeletionReferences } from '@jingwei/module-iam/server/public'

import type { OrganizationDatabase } from './org-unit-store.pg.js'

export class PostgresUserDeletionReferences implements UserDeletionReferences {
  constructor(private readonly database: QueryCreator<OrganizationDatabase>) {}

  async hasReferences(tenantId: TenantId, userId: string): Promise<boolean> {
    const member = await this.database
      .selectFrom('organization.user_org')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('user_id', '=', userId)
      .executeTakeFirst()
    if (member !== undefined) return true
    const position = await this.database
      .selectFrom('organization.user_position')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('user_id', '=', userId)
      .executeTakeFirst()
    return position !== undefined
  }
}
