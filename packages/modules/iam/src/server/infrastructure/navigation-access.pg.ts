import type { Kysely } from 'kysely'

import { ApplicationError, type AuthContext, type TenantId } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import type { IamAccess } from '../public/navigation-access.js'

interface AccessDatabase {
  'iam.role': { id: string; tenant_id: string; code: string; name: string; status: string }
  'iam.user': { id: string; tenant_id: string; status: string }
  'iam.user_role': { tenant_id: string; user_id: string; role_id: string }
  'iam.role_permission': {
    tenant_id: string
    role_id: string
    permission_code: string
    scope_type: string
  }
}

function permissionDenied(): ApplicationError {
  return new ApplicationError({
    code: 'PERMISSION_DENIED',
    message: '没有执行此操作的功能权限',
    status: 403,
  })
}

/** Reject programming errors before any grant query can accidentally authorize a scoped permission. */
export function assertUnscopedPermissionAvailable(
  registry: ModuleRegistry,
  permission: string,
  capability: string,
): void {
  const definition = registry.permission(permission)
  if (definition?.dataScope !== undefined) {
    throw new ApplicationError({
      code: 'AUTHZ_SCOPE_PERMISSION_REQUIRES_EVALUATOR',
      message: '带数据范围的权限必须通过数据范围授权评估器校验',
      status: 500,
    })
  }
  if (definition === null || !registry.hasCapability(capability)) throw permissionDenied()
}

/** Live role reads avoid stale role grants embedded in the session. No is_super bypass. */
export class PostgresIamAccess implements IamAccess {
  constructor(
    private readonly database: Kysely<AccessDatabase>,
    private readonly registry: ModuleRegistry,
  ) {}
  async activeRoleIds(context: AuthContext): Promise<string[]> {
    const rows = await this.database
      .selectFrom('iam.user_role as ur')
      .innerJoin('iam.role as r', 'r.id', 'ur.role_id')
      .innerJoin('iam.user as u', 'u.id', 'ur.user_id')
      .select('r.id')
      .where('ur.tenant_id', '=', context.tenantId)
      .where('r.tenant_id', '=', context.tenantId)
      .where('u.tenant_id', '=', context.tenantId)
      .where('u.id', '=', context.userId)
      .where('u.status', '=', 'ACTIVE')
      .where('r.status', '=', 'ACTIVE')
      .execute()
    return rows.map((row) => row.id)
  }
  roles(tenantId: TenantId) {
    return this.database
      .selectFrom('iam.role')
      .select(['id', 'code', 'name'])
      .where('tenant_id', '=', tenantId)
      .where('status', '=', 'ACTIVE')
      .orderBy('code')
      .execute()
  }
  async effectivePermissionCodes(context: AuthContext): Promise<string[]> {
    const roles = await this.activeRoleIds(context)
    if (roles.length === 0) return []
    const rows = await this.database
      .selectFrom('iam.role_permission')
      .select('permission_code')
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', 'in', roles)
      .execute()
    const enabled = new Set(this.registry.permissions().map((permission) => permission.code))
    return [...new Set(rows.map((row) => row.permission_code))]
      .filter((code) => enabled.has(code))
      .sort((left, right) => left.localeCompare(right))
  }
  async requireUnscopedPermission(
    context: AuthContext,
    permission: string,
    capability: string,
  ): Promise<void> {
    assertUnscopedPermissionAvailable(this.registry, permission, capability)
    const roles = await this.activeRoleIds(context)
    if (roles.length > 0) {
      const grant = await this.database
        .selectFrom('iam.role_permission')
        .select('role_id')
        .where('tenant_id', '=', context.tenantId)
        .where('role_id', 'in', roles)
        .where('permission_code', '=', permission)
        .executeTakeFirst()
      if (grant !== undefined) return
    }
    throw permissionDenied()
  }
}
