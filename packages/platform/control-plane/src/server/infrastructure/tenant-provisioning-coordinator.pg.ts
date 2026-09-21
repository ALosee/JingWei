import { sql, type Kysely } from 'kysely'

import type { TenantId } from '@jingwei/kernel'

import type { TenantProvisioningCoordinator } from '../application/provision-tenant.js'

/** Serializes create/retry orchestration for one tenant across processes. */
export class PostgresTenantProvisioningCoordinator implements TenantProvisioningCoordinator {
  constructor(private readonly database: Kysely<unknown>) {}

  run<T>(tenantId: TenantId, work: () => Promise<T>): Promise<T> {
    return this.database.transaction().execute(async (transaction) => {
      await sql`SELECT pg_advisory_xact_lock(
        hashtext('jingwei.tenant-provisioning'),
        hashtext(${tenantId}::text)
      )`.execute(transaction)
      return work()
    })
  }
}
