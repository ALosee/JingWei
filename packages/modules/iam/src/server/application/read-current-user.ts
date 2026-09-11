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

/** Reads the mutable, safe user projection used by the authenticated application shell. */
export class ReadCurrentUser {
  constructor(private readonly users: CurrentUserReader) {}

  execute(tenantId: TenantId, userId: UserId): Promise<CurrentUserSnapshot | null> {
    return this.users.findActiveById(tenantId, userId)
  }
}
