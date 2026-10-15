import type { QueryCreator } from 'kysely'

import type { TenantId } from '@jingwei/kernel'

import type { IamIdentityReferences } from '../public/identity-lifecycle.js'
import type { IamDatabase } from './credential-reader.pg.js'

export class PostgresIamIdentityReferences implements IamIdentityReferences {
  constructor(private readonly database: QueryCreator<IamDatabase>) {}

  async lockUser(tenantId: TenantId, userId: string): Promise<boolean> {
    const row = await this.database
      .selectFrom('iam.user')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', userId)
      .forKeyShare()
      .executeTakeFirst()
    return row !== undefined
  }

  async lockActiveRole(tenantId: TenantId, roleId: string): Promise<boolean> {
    const row = await this.database
      .selectFrom('iam.role')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', roleId)
      .where('status', '=', 'ACTIVE')
      .forShare()
      .executeTakeFirst()
    return row !== undefined
  }
}
