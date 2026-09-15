import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  CreateOrganizationPosition,
  OrganizationPosition,
  UpdateOrganizationPosition,
} from '../../shared/index.js'

export interface PositionStore {
  listByUnit(tenantId: TenantId, orgUnitId: string): Promise<OrganizationPosition[]>
  get(tenantId: TenantId, id: string): Promise<OrganizationPosition | null>
  unitExists(tenantId: TenantId, orgUnitId: string): Promise<boolean>
  codeTaken(
    tenantId: TenantId,
    orgUnitId: string,
    code: string,
    exceptId?: string,
  ): Promise<boolean>
  hasMembers(tenantId: TenantId, id: string): Promise<boolean>
  insert(context: ApplicationContext, position: OrganizationPosition): Promise<void>
  update(context: ApplicationContext, id: string, patch: UpdateOrganizationPosition): Promise<void>
  delete(context: ApplicationContext, id: string): Promise<void>
}

export interface PositionTransaction {
  store: PositionStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface PositionUnitOfWork {
  run<T>(work: (transaction: PositionTransaction) => Promise<T>): Promise<T>
}

export type { CreateOrganizationPosition }
