import type { Kysely } from 'kysely'

import { toTenantId, type TenantId } from '@jingwei/kernel'

interface TenantTable {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
}

interface TenantDatabase {
  'platform.tenant': TenantTable
}

export interface TenantSnapshot {
  readonly id: TenantId
  readonly code: string
  readonly name: string
  readonly status: TenantTable['status']
}

/** Resolves platform tenants without exposing their table or future database-routing strategy. */
export interface TenantDirectory {
  findActiveByCode(code: string): Promise<TenantSnapshot | null>
}

export class PostgresTenantDirectory implements TenantDirectory {
  constructor(private readonly database: Kysely<TenantDatabase>) {}

  async findActiveByCode(code: string): Promise<TenantSnapshot | null> {
    const row = await this.database
      .selectFrom('platform.tenant')
      .select(['id', 'code', 'name', 'status'])
      .where('code', '=', code)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()

    return row === undefined ? null : { ...row, id: toTenantId(row.id) }
  }
}
