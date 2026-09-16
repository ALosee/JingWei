import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import type {
  CreateIamRole,
  IamRole,
  PermissionCatalog,
  ReplaceRolePermissions,
  RolePermissionGrant,
  RolePermissionGrantView,
  RolePermissionList,
  UpdateIamRole,
} from '../../shared/index.js'
import type { OrganizationalScopeFacts } from '../public/authorization.js'
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
    private readonly organizationalScopeFacts: OrganizationalScopeFacts | null,
  ) {}

  private authorize(context: AuthContext, action: 'view' | 'manage') {
    return this.access.requireUnscopedPermission(context, 'iam.role.' + action, 'iam.authorization')
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
    return { permissions: this.projectGrants(await this.store.listGrants(context.tenantId, id)) }
  }

  private projectGrants(grants: readonly RolePermissionGrant[]): RolePermissionGrantView[] {
    const catalog = new Map(
      this.catalog.list().permissions.map((permission) => [permission.code, permission]),
    )
    return grants
      .map((grant) => {
        const definition = catalog.get(grant.permissionCode)
        return {
          permissionCode: grant.permissionCode,
          moduleId: definition?.moduleId ?? 'unknown',
          name: definition?.name ?? grant.permissionCode,
          allowedScopeTypes: definition?.allowedScopeTypes ?? ['ALL'],
          dataScopeProvider: definition?.dataScopeProvider ?? null,
          scopeType: grant.scopeType,
          ...(grant.organizationIds === undefined
            ? {}
            : { organizationIds: grant.organizationIds }),
        }
      })
      .toSorted((left, right) =>
        left.moduleId === right.moduleId
          ? left.permissionCode.localeCompare(right.permissionCode)
          : left.moduleId.localeCompare(right.moduleId),
      )
  }

  async replacePermissions(
    context: AuthContext,
    id: string,
    input: ReplaceRolePermissions,
  ): Promise<RolePermissionList> {
    await this.authorize(context, 'manage')
    await this.validateGrants(context, input.permissions)
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)

      const before = await tx.store.listGrants(context.tenantId, id)
      await tx.store.replaceGrants(context, id, input.permissions)
      const permissions = this.projectGrants(await tx.store.listGrants(context.tenantId, id))
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

  private async validateGrants(
    context: AuthContext,
    grants: readonly RolePermissionGrant[],
  ): Promise<void> {
    const seen = new Set<string>()
    for (const grant of grants) {
      if (seen.has(grant.permissionCode))
        fail('IAM_ROLE_PERMISSION_DUPLICATE', '同一次授权中权限不能重复')
      seen.add(grant.permissionCode)
      const definition = this.registry.permission(grant.permissionCode)
      if (definition === null)
        fail('IAM_PERMISSION_UNKNOWN', `权限不存在：${grant.permissionCode}`, 400)
      const allowedTypes = definition.dataScope?.allowedTypes ?? ['ALL']
      if (!allowedTypes.includes(grant.scopeType))
        fail(
          'IAM_PERMISSION_SCOPE_UNSUPPORTED',
          `权限 ${grant.permissionCode} 不允许数据范围 ${grant.scopeType}`,
          400,
        )
      const organizationIds = grant.organizationIds ?? []
      if (grant.scopeType === 'CUSTOM') {
        if (organizationIds.length === 0)
          fail('IAM_PERMISSION_SCOPE_CUSTOM_EMPTY', '自定义组织范围必须至少选择一个组织', 400)
        if (new Set(organizationIds).size !== organizationIds.length)
          fail('IAM_PERMISSION_SCOPE_CUSTOM_DUPLICATE', '自定义组织范围不能包含重复组织', 400)
      } else if (organizationIds.length > 0)
        fail('IAM_PERMISSION_SCOPE_ORGS_UNUSED', '仅自定义组织范围可以携带组织列表', 400)
      if (grant.scopeType !== 'ALL' && definition.dataScope?.provider !== undefined) {
        if (this.organizationalScopeFacts === null)
          fail('IAM_DATA_SCOPE_PROVIDER_UNAVAILABLE', '当前版本未提供所需的数据范围事实', 409)
        if (definition.dataScope.provider !== 'organization')
          fail('IAM_DATA_SCOPE_PROVIDER_UNSUPPORTED', '当前版本不支持该数据范围提供者', 409)
      }
      if (grant.scopeType === 'CUSTOM') {
        if (this.organizationalScopeFacts === null)
          fail('IAM_DATA_SCOPE_PROVIDER_UNAVAILABLE', '当前版本未提供组织范围事实', 409)
        const validIds = new Set(
          await this.organizationalScopeFacts.validOrgUnitIds(context.tenantId, organizationIds),
        )
        if (organizationIds.some((id) => !validIds.has(id)))
          fail(
            'IAM_PERMISSION_SCOPE_ORGANIZATION_INVALID',
            '自定义组织范围包含不存在、已停用或不属于当前租户的组织',
            400,
          )
      }
    }
  }
}

export type { PermissionCatalog }
