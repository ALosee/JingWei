import type { Kysely } from 'kysely'

import { PostgresPlatformAuditWriter } from '@jingwei/audit'
import { toTenantId, type TenantId } from '@jingwei/kernel'

import type {
  TenantStore,
  TenantTransaction,
  TenantUnitOfWork,
} from '../application/manage-tenants.js'
import type { TenantProvisioningStep, TenantSnapshot, TenantStatus } from '../model.js'

interface TenantTable {
  id: string
  code: string
  name: string
  status: TenantStatus
  default_locale: string
  default_timezone: string
  default_currency: string
  settings: unknown
  version: string
  provisioning_step: TenantProvisioningStep
  provisioning_error_code: string | null
  created_at: Date
  updated_at: Date
}

export interface TenancyDatabase {
  'platform.tenant': TenantTable
}

function toSnapshot(row: TenantTable): TenantSnapshot {
  return {
    id: toTenantId(row.id),
    code: row.code,
    name: row.name,
    status: row.status,
    defaultLocale: row.default_locale,
    defaultTimezone: row.default_timezone,
    defaultCurrency: row.default_currency,
    version: Number(row.version),
    provisioningStep: row.provisioning_step,
    provisioningErrorCode: row.provisioning_error_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresTenantStore implements TenantStore {
  constructor(private readonly database: Kysely<TenancyDatabase>) {}

  async list(): Promise<readonly TenantSnapshot[]> {
    const rows = await this.database
      .selectFrom('platform.tenant')
      .selectAll()
      .orderBy('code')
      .execute()
    return rows.map(toSnapshot)
  }

  async findByCode(code: string, lock = false): Promise<TenantSnapshot | null> {
    let query = this.database.selectFrom('platform.tenant').selectAll().where('code', '=', code)
    if (lock) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    return row === undefined ? null : toSnapshot(row)
  }

  async get(id: TenantId, lock = false): Promise<TenantSnapshot | null> {
    let query = this.database.selectFrom('platform.tenant').selectAll().where('id', '=', id)
    if (lock) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    return row === undefined ? null : toSnapshot(row)
  }

  async insert(tenant: TenantSnapshot): Promise<void> {
    await this.database
      .insertInto('platform.tenant')
      .values({
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        status: tenant.status,
        default_locale: tenant.defaultLocale,
        default_timezone: tenant.defaultTimezone,
        default_currency: tenant.defaultCurrency,
        settings: {},
        version: String(tenant.version),
        provisioning_step: tenant.provisioningStep,
        provisioning_error_code: tenant.provisioningErrorCode,
        created_at: new Date(tenant.createdAt),
        updated_at: new Date(tenant.updatedAt),
      })
      .executeTakeFirstOrThrow()
  }

  async update(
    id: TenantId,
    expectedVersion: number,
    patch: {
      readonly status?: TenantStatus
      readonly provisioningStep?: TenantProvisioningStep
      readonly provisioningErrorCode?: string | null
      readonly updatedAt: Date
    },
  ): Promise<void> {
    const result = await this.database
      .updateTable('platform.tenant')
      .set({
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.provisioningStep === undefined
          ? {}
          : { provisioning_step: patch.provisioningStep }),
        ...(patch.provisioningErrorCode === undefined
          ? {}
          : { provisioning_error_code: patch.provisioningErrorCode }),
        version: String(expectedVersion + 1),
        updated_at: patch.updatedAt,
      })
      .where('id', '=', id)
      .where('version', '=', String(expectedVersion))
      .executeTakeFirst()
    if (Number(result.numUpdatedRows) !== 1) throw new Error('Tenant optimistic update failed')
  }
}

export class PostgresTenantUnitOfWork implements TenantUnitOfWork {
  constructor(private readonly database: Kysely<TenancyDatabase>) {}

  run<TResult>(work: (transaction: TenantTransaction) => Promise<TResult>): Promise<TResult> {
    return this.database.transaction().execute(async (transaction) =>
      work({
        store: new PostgresTenantStore(transaction),
        record: async (context, tenantId, action, before, after) => {
          await new PostgresPlatformAuditWriter(transaction).appendPlatform({
            context,
            tenantId,
            module: 'tenancy',
            action,
            entityType: 'tenant',
            entityId: tenantId,
            result: 'SUCCESS',
            before,
            after,
          })
        },
      }),
    )
  }
}
