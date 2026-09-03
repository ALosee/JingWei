import type { AuthContext, TenantId } from '@jingwei/kernel'

/** Minimal IAM port consumed by Navigation; no IAM database types cross the boundary. */
export interface IamAccess {
  activeRoleIds(context: AuthContext): Promise<readonly string[]>
  roles(tenantId: TenantId): Promise<{ id: string; code: string; name: string }[]>
  requirePermission(context: AuthContext, permission: string, capability: string): Promise<void>
}
