import type { DatabaseConnection } from '@jingwei/database'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

/** Consumer-owned references: enabled modules bind these readers to IAM's transaction. */
export interface UserDeletionReferences {
  hasReferences(tenantId: TenantId, userId: string): Promise<boolean>
}

export interface RoleDeletionCleanup {
  removeRoleGrants(context: ApplicationContext, roleId: string): Promise<void>
}

export type UserDeletionReferencesFactory = (
  connection: DatabaseConnection,
) => UserDeletionReferences
export type RoleDeletionCleanupFactory = (connection: DatabaseConnection) => RoleDeletionCleanup

/** Call inside the referencing write transaction, before writing an IAM UUID reference. */
export interface IamIdentityReferences {
  lockUser(tenantId: TenantId, userId: string): Promise<boolean>
  lockActiveRole(tenantId: TenantId, roleId: string): Promise<boolean>
}
