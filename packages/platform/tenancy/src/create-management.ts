import type { SessionService } from '@jingwei/auth'
import type { DatabaseRuntime } from '@jingwei/database'
import { systemClock } from '@jingwei/kernel'

import { ManageTenants } from './application/manage-tenants.js'
import {
  PostgresTenantStore,
  PostgresTenantUnitOfWork,
  type TenancyDatabase,
} from './infrastructure/tenant-store.pg.js'

export function createTenantManagement(
  database: DatabaseRuntime,
  sessions: Pick<SessionService, 'revokeTenant'>,
): ManageTenants {
  const view = database.view<TenancyDatabase>()
  return new ManageTenants(
    new PostgresTenantStore(view),
    new PostgresTenantUnitOfWork(view),
    sessions,
    systemClock,
  )
}
