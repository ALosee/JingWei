import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  CreateIamRole,
  IamRole,
  RolePermissionGrant,
  RolePermissionGrantView,
  UpdateIamRole,
} from '../../shared/index.js'

export interface RoleStore {
  list(tenantId: TenantId): Promise<IamRole[]>
  get(tenantId: TenantId, id: string): Promise<IamRole | null>
  codeTaken(tenantId: TenantId, code: string, exceptId?: string): Promise<boolean>
  hasAssignments(tenantId: TenantId, id: string): Promise<boolean>
  insert(context: ApplicationContext, role: IamRole): Promise<void>
  update(context: ApplicationContext, id: string, patch: UpdateIamRole): Promise<void>
  delete(context: ApplicationContext, id: string): Promise<void>
  listGrants(tenantId: TenantId, roleId: string): Promise<RolePermissionGrantView[]>
  replaceGrants(
    context: ApplicationContext,
    roleId: string,
    grants: readonly RolePermissionGrant[],
  ): Promise<void>
}

export interface RoleTransaction {
  store: RoleStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface RoleUnitOfWork {
  run<T>(work: (transaction: RoleTransaction) => Promise<T>): Promise<T>
}

export type { CreateIamRole, IamRole }
