import type { TenantId } from '@jingwei/kernel'

import type { NavigationVersion } from '../../shared/index.js'

export type { NavigationConfiguration } from '../../shared/index.js'

export interface NavigationSource {
  loadPublished(tenantId: TenantId): Promise<NavigationVersion | null>
  grantedCodes(tenantId: TenantId, roleIds: readonly string[]): Promise<ReadonlySet<string>>
}
