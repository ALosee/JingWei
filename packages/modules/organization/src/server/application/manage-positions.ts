import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { AuthorizationEvaluator, IamAccess } from '@jingwei/module-iam/server/public'

import {
  isOrgUnitInDataScope,
  type CreateOrganizationPosition,
  type OrganizationPosition,
  type UpdateOrganizationPosition,
} from '../../shared/index.js'
import { organizationPermissionRequirements } from '../public/permission-requirements.js'
import type { PositionStore, PositionUnitOfWork } from './position-store.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Positions live under one org unit; uniqueness is tenant + org + code. */
export class ManageOrganizationPositions {
  constructor(
    private readonly store: PositionStore,
    private readonly work: PositionUnitOfWork,
    private readonly access: IamAccess,
    private readonly evaluator: AuthorizationEvaluator,
  ) {}

  private authorizeManage(context: AuthContext) {
    return this.access.requireUnscopedPermission(context, organizationPermissionRequirements.manage)
  }

  /** organization.view supports data scope, so view goes through the evaluator. */
  private async authorizeViewInScope(context: AuthContext, orgUnitId: string) {
    const dataScope = await this.evaluator.requireScopedPermission({
      context,
      requirement: organizationPermissionRequirements.view,
    })
    if (!isOrgUnitInDataScope(orgUnitId, dataScope))
      fail('PERMISSION_DENIED', '没有该组织的数据访问范围', 403)
  }

  async listByUnit(context: AuthContext, orgUnitId: string) {
    await this.authorizeViewInScope(context, orgUnitId)
    if (!(await this.store.unitExists(context.tenantId, orgUnitId)))
      fail('ORGANIZATION_UNIT_NOT_FOUND', '组织不存在', 404)
    return { positions: await this.store.listByUnit(context.tenantId, orgUnitId) }
  }

  async create(
    context: AuthContext,
    orgUnitId: string,
    input: CreateOrganizationPosition,
  ): Promise<OrganizationPosition> {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      if (!(await tx.store.unitExists(context.tenantId, orgUnitId)))
        fail('ORGANIZATION_UNIT_NOT_FOUND', '组织不存在', 404)
      if (await tx.store.codeTaken(context.tenantId, orgUnitId, input.code))
        fail('ORGANIZATION_POSITION_CODE_CONFLICT', '岗位编码在该组织内已存在')
      const position: OrganizationPosition = {
        id: newEntityId(),
        orgUnitId,
        code: input.code,
        name: input.name,
        status: input.status ?? 'ENABLED',
        sortOrder: input.sortOrder ?? 0,
      }
      await tx.store.insert(context, position)
      await tx.record(context, 'position_created', position.id, null, position)
      return position
    })
  }

  async update(
    context: AuthContext,
    orgUnitId: string,
    id: string,
    input: UpdateOrganizationPosition,
  ): Promise<OrganizationPosition> {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing?.orgUnitId !== orgUnitId)
        fail('ORGANIZATION_POSITION_NOT_FOUND', '岗位不存在', 404)
      const nextCode = input.code ?? existing.code
      if (nextCode !== existing.code) {
        if (await tx.store.codeTaken(context.tenantId, existing.orgUnitId, nextCode, id))
          fail('ORGANIZATION_POSITION_CODE_CONFLICT', '岗位编码在该组织内已存在')
      }
      const patch: UpdateOrganizationPosition = {
        ...(input.code === undefined ? {} : { code: input.code }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      }
      await tx.store.update(context, id, patch)
      const updated = await tx.store.get(context.tenantId, id)
      if (updated === null) fail('ORGANIZATION_POSITION_NOT_FOUND', '岗位不存在', 404)
      await tx.record(context, 'position_updated', id, existing, updated)
      return updated
    })
  }

  /** Empty position only; occupied positions must be disabled instead. */
  async remove(context: AuthContext, orgUnitId: string, id: string) {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing?.orgUnitId !== orgUnitId)
        fail('ORGANIZATION_POSITION_NOT_FOUND', '岗位不存在', 404)
      if (await tx.store.hasMembers(context.tenantId, id))
        fail(
          'ORGANIZATION_POSITION_HAS_MEMBERS',
          '仍有用户担任该岗位时不能删除，请先解除关联或改为停用',
        )
      await tx.store.delete(context, id)
      await tx.record(context, 'position_deleted', id, existing, null)
      return { id }
    })
  }
}
