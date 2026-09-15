import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import type {
  CreateIamRole,
  IamRole,
  PermissionCatalog,
  ReplaceRolePermissions,
  RolePermissionList,
  UpdateIamRole,
} from '../../shared/index.js'
import type { IamAccess } from '../public/navigation-access.js'
import type { ReadPermissionCatalog } from './permission-catalog.js'
import type { RoleStore, RoleUnitOfWork } from './role-store.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Role code is immutable after create; system roles cannot be deleted. */
export class ManageIamRoles {
  constructor(
    private readonly store: RoleStore,
    private readonly work: RoleUnitOfWork,
    private readonly access: IamAccess,
    private readonly registry: ModuleRegistry,
    private readonly catalog: ReadPermissionCatalog,
  ) {}

  private authorize(context: AuthContext, action: 'view' | 'manage') {
    return this.access.requirePermission(context, 'iam.role.' + action, 'iam.authorization')
  }

  async list(context: AuthContext) {
    await this.authorize(context, 'view')
    return { roles: await this.store.list(context.tenantId) }
  }

  async get(context: AuthContext, id: string): Promise<IamRole> {
    await this.authorize(context, 'view')
    const role = await this.store.get(context.tenantId, id)
    if (role === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)
    return role
  }

  async create(context: AuthContext, input: CreateIamRole): Promise<IamRole> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      if (await tx.store.codeTaken(context.tenantId, input.code))
        fail('IAM_ROLE_CODE_CONFLICT', '角色编码在租户内已存在')
      const now = new Date().toISOString()
      const role: IamRole = {
        id: newEntityId(),
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'ACTIVE',
        isSystem: false,
        assignmentCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      await tx.store.insert(context, role)
      await tx.record(context, 'role_created', role.id, null, role)
      return role
    })
  }

  async update(context: AuthContext, id: string, input: UpdateIamRole): Promise<IamRole> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)
      await tx.store.update(context, id, input)
      const updated = await tx.store.get(context.tenantId, id)
      if (updated === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)
      await tx.record(context, 'role_updated', id, existing, updated)
      return updated
    })
  }

  /** Occupied or system roles must be disabled instead of deleted. */
  async remove(context: AuthContext, id: string) {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)
      if (existing.isSystem) fail('IAM_ROLE_SYSTEM_PROTECTED', '系统角色不能删除，请改为停用')
      if (await tx.store.hasAssignments(context.tenantId, id))
        fail('IAM_ROLE_HAS_ASSIGNMENTS', '仍有用户分配该角色时不能删除，请先解除分配或改为停用')
      await tx.store.delete(context, id)
      await tx.record(context, 'role_deleted', id, existing, null)
      return { id }
    })
  }

  async listPermissions(context: AuthContext): Promise<PermissionCatalog> {
    await this.authorize(context, 'view')
    return this.catalog.list()
  }

  async listRolePermissions(context: AuthContext, id: string): Promise<RolePermissionList> {
    await this.authorize(context, 'view')
    const role = await this.store.get(context.tenantId, id)
    if (role === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)
    return { permissions: await this.store.listGrants(context.tenantId, id) }
  }

  async replacePermissions(
    context: AuthContext,
    id: string,
    input: ReplaceRolePermissions,
  ): Promise<RolePermissionList> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)

      const seen = new Set<string>()
      for (const grant of input.permissions) {
        if (seen.has(grant.permissionCode))
          fail('IAM_ROLE_PERMISSION_DUPLICATE', '同一次授权中权限不能重复')
        seen.add(grant.permissionCode)
        const definition = this.registry.permission(grant.permissionCode)
        if (definition === null)
          fail('IAM_PERMISSION_UNKNOWN', `权限不存在：${grant.permissionCode}`, 400)
        const supportsDataScope = definition.supportsDataScope ?? false
        if (!supportsDataScope && grant.scopeType !== 'ALL')
          fail(
            'IAM_PERMISSION_SCOPE_UNSUPPORTED',
            `权限 ${grant.permissionCode} 不支持数据范围，请使用 ALL`,
            400,
          )
        if (supportsDataScope && grant.scopeType === 'CUSTOM')
          fail(
            'IAM_PERMISSION_SCOPE_CUSTOM_UNSUPPORTED',
            '自定义组织范围暂未开放，请选择其他数据范围',
            400,
          )
      }

      const before = await tx.store.listGrants(context.tenantId, id)
      await tx.store.replaceGrants(context, id, input.permissions)
      const permissions = await tx.store.listGrants(context.tenantId, id)
      await tx.record(
        context,
        'role_permissions_replaced',
        id,
        { permissions: before },
        { permissions },
      )
      return { permissions }
    })
  }
}

export type { PermissionCatalog }
