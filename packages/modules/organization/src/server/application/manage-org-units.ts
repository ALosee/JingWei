import { ApplicationError, newEntityId, type AuthContext, type TenantId } from '@jingwei/kernel'
import type { AuthorizationEvaluator, IamAccess } from '@jingwei/module-iam/server/public'

import type {
  CreateOrganizationUnit,
  OrganizationUnit,
  UpdateOrganizationUnit,
} from '../../shared/index.js'
import { organizationPermissionRequirements } from '../public/permission-requirements.js'
import type { OrgUnitStore, OrgUnitOfWork } from './org-unit-store.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Application owns authorization, tenant scoping, move-cycle rules and delete gates. */
export class ManageOrganizationUnits {
  constructor(
    private readonly store: OrgUnitStore,
    private readonly work: OrgUnitOfWork,
    private readonly access: IamAccess,
    private readonly evaluator: AuthorizationEvaluator,
  ) {}

  private authorizeManage(context: AuthContext) {
    return this.access.requireUnscopedPermission(context, organizationPermissionRequirements.manage)
  }

  async tree(context: AuthContext) {
    const dataScope = await this.evaluator.requireScopedPermission({
      context,
      requirement: organizationPermissionRequirements.view,
    })
    if (dataScope.type === 'ALL') return { units: await this.store.list(context.tenantId) }
    if (dataScope.type === 'SELF') return { units: [] }
    return {
      units: await this.store.listVisibleTree(context.tenantId, dataScope.organizationIds),
    }
  }

  async create(context: AuthContext, input: CreateOrganizationUnit): Promise<OrganizationUnit> {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      if (input.parentId !== null)
        await this.assertParent(tx.store, context.tenantId, input.parentId)
      await this.assertCodeFree(tx.store, context.tenantId, input.code)
      const now = new Date()
      const unit: OrganizationUnit = {
        id: newEntityId(),
        parentId: input.parentId,
        code: input.code,
        name: input.name,
        type: input.type,
        status: input.status ?? 'ENABLED',
        sortOrder: input.sortOrder ?? 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await tx.store.insert(context, unit)
      await tx.record(context, 'created', unit.id, null, unit)
      return unit
    })
  }

  async update(
    context: AuthContext,
    id: string,
    input: UpdateOrganizationUnit,
  ): Promise<OrganizationUnit> {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      const existing = await this.required(tx.store, context.tenantId, id)
      const nextParentId = input.parentId === undefined ? existing.parentId : input.parentId
      if (nextParentId !== existing.parentId) {
        if (nextParentId === id) fail('ORGANIZATION_MOVE_CYCLE', '不能将组织移动到自身或其下级')
        if (nextParentId !== null) {
          await this.assertParent(tx.store, context.tenantId, nextParentId)
          if (await tx.store.isDescendant(context.tenantId, id, nextParentId))
            fail('ORGANIZATION_MOVE_CYCLE', '不能将组织移动到自身或其下级')
        }
      }
      const nextCode = input.code ?? existing.code
      if (nextCode !== existing.code)
        await this.assertCodeFree(tx.store, context.tenantId, nextCode, id)
      const now = new Date()
      const patch: UpdateOrganizationUnit & { updatedAt: Date } = {
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(input.code === undefined ? {} : { code: input.code }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        updatedAt: now,
      }
      await tx.store.update(context, id, patch)
      const updated = await this.required(tx.store, context.tenantId, id)
      await tx.record(context, 'updated', id, existing, updated)
      return updated
    })
  }

  /** Empty leaf only; otherwise disable. Positions and members block physical delete. */
  async remove(context: AuthContext, id: string) {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      const existing = await this.required(tx.store, context.tenantId, id)
      if (await tx.store.hasChildren(context.tenantId, id))
        fail('ORGANIZATION_HAS_CHILDREN', '存在下级组织时不能删除，请先处理子节点或改为禁用')
      if (await tx.store.hasMembers(context.tenantId, id))
        fail('ORGANIZATION_HAS_MEMBERS', '组织仍有成员归属时不能删除，请先移除成员或改为禁用')
      if (await tx.store.hasPositions(context.tenantId, id))
        fail('ORGANIZATION_HAS_POSITIONS', '组织仍有岗位时不能删除，请先清理岗位或改为禁用')
      await tx.store.delete(context, id)
      await tx.record(context, 'deleted', id, existing, null)
      return { id }
    })
  }

  private async required(store: OrgUnitStore, tenantId: TenantId, id: string) {
    const unit = await store.get(tenantId, id)
    if (unit === null) fail('ORGANIZATION_UNIT_NOT_FOUND', '组织不存在', 404)
    return unit
  }

  private async assertParent(store: OrgUnitStore, tenantId: TenantId, parentId: string) {
    if (!(await store.exists(tenantId, parentId)))
      fail('ORGANIZATION_PARENT_NOT_FOUND', '上级组织不存在', 404)
  }

  private async assertCodeFree(
    store: OrgUnitStore,
    tenantId: TenantId,
    code: string,
    exceptId?: string,
  ) {
    if (await store.codeTaken(tenantId, code, exceptId))
      fail('ORGANIZATION_CODE_CONFLICT', '组织编码在当前租户内已存在')
  }
}
