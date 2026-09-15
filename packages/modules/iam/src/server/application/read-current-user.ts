import type { TenantId, UserId } from '@jingwei/kernel'

export interface CurrentUserSnapshot {
  readonly id: UserId
  readonly tenantId: TenantId
  readonly displayName: string
  readonly avatarUrl: string | null
}

export interface CurrentUserReader {
  findActiveById(tenantId: TenantId, userId: UserId): Promise<CurrentUserSnapshot | null>
}
