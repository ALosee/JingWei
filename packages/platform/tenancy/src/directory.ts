import type { Kysely } from 'kysely'

import { toTenantId, type TenantId } from '@jingwei/kernel'

import type { TenantStatus } from './model.js'

interface TenantDirectoryTable {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly status: TenantStatus
}

interface TenantDirectoryDatabase {
  'platform.tenant': TenantDirectoryTable
}

export interface ActiveTenantSnapshot {
  readonly id: TenantId
  readonly code: string
  readonly name: string
  readonly status: 'ACTIVE'
}

/** Minimal trust-boundary lookup used by anonymous bootstrap and authentication. */
export interface TenantDirectory {
  findActiveByCode(code: string): Promise<ActiveTenantSnapshot | null>
  isActive(tenantId: TenantId): Promise<boolean>
}

export class PostgresTenantDirectory implements TenantDirectory {
  constructor(private readonly database: Kysely<TenantDirectoryDatabase>) {}

  async findActiveByCode(code: string): Promise<ActiveTenantSnapshot | null> {
    const row = await this.database
      .selectFrom('platform.tenant')
      .select(['id', 'code', 'name', 'status'])
      .where('code', '=', normalizeTenantCode(code))
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()

    return row === undefined
      ? null
      : { id: toTenantId(row.id), code: row.code, name: row.name, status: 'ACTIVE' }
  }

  async isActive(tenantId: TenantId): Promise<boolean> {
    const row = await this.database
      .selectFrom('platform.tenant')
      .select('id')
      .where('id', '=', tenantId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()
    return row !== undefined
  }
}

export function normalizeTenantCode(code: string): string {
  return code.trim().toLocaleLowerCase('en-US')
}
