import type { Kysely } from 'kysely'

import { PostgresPlatformAuditWriter } from '@jingwei/audit'

import type {
  TenantNavigationProvisioningTransaction,
  TenantNavigationProvisioningUnitOfWork,
} from '../application/provision-tenant-navigation.js'
import { PostgresNavigationStore, type NavigationDatabase } from './navigation-store.pg.js'

export class PostgresTenantNavigationProvisioningUnitOfWork implements TenantNavigationProvisioningUnitOfWork {
  constructor(private readonly database: Kysely<NavigationDatabase>) {}

  run<T>(work: (transaction: TenantNavigationProvisioningTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction().execute(async (transaction) =>
      work({
        store: new PostgresNavigationStore(transaction),
        recordPlatform: async (context, tenantId, action, entityId, before, after) => {
          await new PostgresPlatformAuditWriter(transaction).appendPlatform({
            context,
            tenantId,
            module: 'navigation',
            action,
            entityType: 'navigation',
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
