import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { OrganizationUnit, UpdateOrganizationUnit } from '../../shared/index.js'

export interface OrgUnitStore {
  list(tenantId: TenantId): Promise<OrganizationUnit[]>
  get(tenantId: TenantId, id: string): Promise<OrganizationUnit | null>
  exists(tenantId: TenantId, id: string): Promise<boolean>
  codeTaken(tenantId: TenantId, code: string, exceptId?: string): Promise<boolean>
  hasChildren(tenantId: TenantId, id: string): Promise<boolean>
  hasMembers(tenantId: TenantId, id: string): Promise<boolean>
  hasPositions(tenantId: TenantId, id: string): Promise<boolean>
  isDescendant(tenantId: TenantId, rootId: string, candidateId: string): Promise<boolean>
  insert(context: ApplicationContext, unit: OrganizationUnit): Promise<void>
  update(
    context: ApplicationContext,
    id: string,
    patch: UpdateOrganizationUnit & { updatedAt: Date },
  ): Promise<void>
  delete(context: ApplicationContext, id: string): Promise<void>
}

export interface OrgUnitTransaction {
  store: OrgUnitStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface OrgUnitOfWork {
  run<T>(work: (transaction: OrgUnitTransaction) => Promise<T>): Promise<T>
}
