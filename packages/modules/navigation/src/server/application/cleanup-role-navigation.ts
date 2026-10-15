import type { ApplicationContext } from '@jingwei/kernel'
import type { RoleDeletionCleanup } from '@jingwei/module-iam/server/public'

import type { NavigationTransaction } from './navigation-store.js'

/** Runs on the caller-owned transaction; role identity is locked before the navigation root. */
export class CleanupRoleNavigation implements RoleDeletionCleanup {
  constructor(private readonly transaction: NavigationTransaction) {}

  async removeRoleGrants(context: ApplicationContext, roleId: string): Promise<void> {
    const { store } = this.transaction
    await store.root(context.tenantId, true)
    const codes = await store.roleCodes(context.tenantId, roleId)
    if (codes.length === 0) return
    await store.replaceRoleCodes(context, roleId, [])
    await this.transaction.record(context, 'role_grants_deleted', roleId, { codes }, null)
  }
}
