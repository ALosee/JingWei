import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { RoleMember, RoleMemberQuery } from '../../shared/index.js'

export interface RoleMemberSnapshot {
  readonly userIds: readonly string[]
  readonly snapshot: string
}

export interface RoleMemberStore {
  lockAdministration(tenantId: TenantId): Promise<void>
  lockRole(tenantId: TenantId, roleId: string): Promise<{ status: 'ACTIVE' | 'DISABLED' } | null>
  snapshot(tenantId: TenantId, roleId: string): Promise<RoleMemberSnapshot>
  list(
    tenantId: TenantId,
    roleId: string,
    query: RoleMemberQuery,
    candidates: boolean,
  ): Promise<{ members: RoleMember[]; total: number }>
  lockActiveUsers(tenantId: TenantId, userIds: readonly string[]): Promise<readonly string[]>
  add(context: ApplicationContext, roleId: string, userIds: readonly string[]): Promise<void>
  remove(context: ApplicationContext, roleId: string, userIds: readonly string[]): Promise<void>
  clear(context: ApplicationContext, roleId: string): Promise<void>
  hasActiveManager(tenantId: TenantId): Promise<boolean>
}

export interface RoleMemberTransaction {
  store: RoleMemberStore
  record(
    context: ApplicationContext,
    action: string,
    roleId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface RoleMemberUnitOfWork {
  run<T>(work: (transaction: RoleMemberTransaction) => Promise<T>): Promise<T>
}
