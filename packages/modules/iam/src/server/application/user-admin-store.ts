import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  CreateManagedUser,
  ManagedUser,
  UpdateManagedUser,
  UserRoleAssignment,
} from '../../shared/index.js'

export interface UserAdminStore {
  list(tenantId: TenantId): Promise<ManagedUser[]>
  get(tenantId: TenantId, id: string): Promise<ManagedUser | null>
  usernameTaken(tenantId: TenantId, usernameNormalized: string): Promise<boolean>
  emailTaken(tenantId: TenantId, emailNormalized: string, exceptUserId?: string): Promise<boolean>
  countOtherActiveManagers(tenantId: TenantId, exceptUserId: string): Promise<number>
  userHasActiveManagePermission(tenantId: TenantId, userId: string): Promise<boolean>
  rolesIncludeManagePermission(tenantId: TenantId, roleIds: readonly string[]): Promise<boolean>
  rolesExist(tenantId: TenantId, roleIds: readonly string[]): Promise<boolean>
  listUserRoles(tenantId: TenantId, userId: string): Promise<UserRoleAssignment[]>
  insertUser(
    context: ApplicationContext,
    input: {
      readonly id: string
      readonly username: string
      readonly usernameNormalized: string
      readonly displayName: string
      readonly email: string | null
      readonly emailNormalized: string | null
      readonly phone: string | null
      readonly passwordHash: string
      readonly passwordChangedAt: Date
      readonly status: 'ACTIVE' | 'INVITED'
    },
  ): Promise<void>
  updateUser(
    context: ApplicationContext,
    id: string,
    patch: UpdateManagedUser & { emailNormalized?: string | null },
  ): Promise<void>
  updateUserPassword(
    context: ApplicationContext,
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<void>
  replaceUserRoles(
    context: ApplicationContext,
    userId: string,
    roleIds: readonly string[],
  ): Promise<void>
}

export interface UserAdminTransaction {
  store: UserAdminStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface UserAdminUnitOfWork {
  run<T>(work: (transaction: UserAdminTransaction) => Promise<T>): Promise<T>
}

export type { CreateManagedUser, ManagedUser }
