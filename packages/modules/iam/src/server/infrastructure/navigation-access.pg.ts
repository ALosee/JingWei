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
  async requirePermission(
    context: AuthContext,
    permission: string,
    capability: string,
  ): Promise<void> {
    const definition = this.registry.permission(permission)
    if (
      definition !== null &&
      this.registry.hasCapability(capability) &&
      !definition.supportsDataScope
    ) {
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
    }
    throw new ApplicationError({
      code: 'PERMISSION_DENIED',
      message: '没有执行此操作的功能权限',
      status: 403,
    })
  }
}
