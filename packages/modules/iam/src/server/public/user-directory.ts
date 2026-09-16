import type { TenantId } from '@jingwei/kernel'

export type IamUserDirectoryStatus = 'INVITED' | 'ACTIVE' | 'DISABLED' | 'LOCKED'

/** Safe user projection for cross-module display; never includes credentials or tokens. */
export interface IamUserSafeProfile {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly status: IamUserDirectoryStatus
  readonly avatar: string | null
}

/**
 * Minimal IAM user lookup for modules that store IAM user ids without foreign keys.
 * Implementations must scope every query to the provided tenantId.
 */
export interface IamUserDirectory {
  findSafeProfiles(
    tenantId: TenantId,
    userIds: readonly string[],
  ): Promise<readonly IamUserSafeProfile[]>
  usersExist(tenantId: TenantId, userIds: readonly string[]): Promise<ReadonlySet<string>>
  /** Tenant user directory for pickers; never includes credentials. */
  listSafeProfiles(
    tenantId: TenantId,
    options?: { status?: IamUserDirectoryStatus },
  ): Promise<readonly IamUserSafeProfile[]>
}
