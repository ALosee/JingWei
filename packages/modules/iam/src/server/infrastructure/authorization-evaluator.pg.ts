import type { Kysely } from 'kysely'

import { ApplicationError } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import type { RoleDataScopeType } from '../../shared/index.js'
import { mergeDataScopes, type ScopeGrantInput } from '../application/merge-data-scopes.js'
import type {
  AuthorizationEvaluator,
  AuthorizationRequest,
  DataScopeGrant,
  OrganizationalScopeFacts,
} from '../public/authorization.js'

interface AuthorizationDatabase {
  'iam.user': { id: string; tenant_id: string; status: string }
  'iam.user_role': { tenant_id: string; user_id: string; role_id: string }
  'iam.role': { id: string; tenant_id: string; status: string }
  'iam.role_permission': {
    tenant_id: string
    role_id: string
    permission_code: string
    scope_type: string
  }
  'iam.role_permission_org_scope': {
    tenant_id: string
    role_id: string
    permission_code: string
    org_unit_id: string
  }
}

function deny(): never {
  throw new ApplicationError({
    code: 'PERMISSION_DENIED',
    message: '没有执行此操作的功能权限',
    status: 403,
  })
}

/**
 * Live allow-only evaluator: unions active role grants and expands data scopes via Organization port.
 * Never uses is_super. Disabled users and non-ACTIVE roles are excluded.
 */
export class PostgresAuthorizationEvaluator implements AuthorizationEvaluator {
  constructor(
    private readonly database: Kysely<AuthorizationDatabase>,
    private readonly registry: ModuleRegistry,
    private readonly organization: OrganizationalScopeFacts,
  ) {}

  async requireScopedPermission(request: AuthorizationRequest): Promise<DataScopeGrant> {
    const definition = this.registry.permission(request.permission)
    if (definition === null || !this.registry.hasCapability(request.capability)) return deny()
    if (definition.dataScope === undefined) {
      throw new ApplicationError({
        code: 'AUTHZ_UNSCOPED_PERMISSION_REQUIRES_ACCESS',
        message: '无数据范围的权限必须通过基础权限入口校验',
        status: 500,
      })
    }

    const { context } = request
    const activeRoles = await this.activeRoleIds(context.tenantId, context.userId)
    if (activeRoles.length === 0) return deny()

    const grantRows = await this.database
      .selectFrom('iam.role_permission')
      .select(['role_id', 'scope_type'])
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', 'in', activeRoles)
      .where('permission_code', '=', request.permission)
      .execute()
    if (grantRows.length === 0) return deny()

    const allowedTypes: ReadonlySet<string> = new Set(definition.dataScope.allowedTypes)
    if (grantRows.some((row) => !allowedTypes.has(row.scope_type))) return deny()

    const customOrgByRole = new Map<string, string[]>()
    const needsCustom = grantRows.some((row) => row.scope_type === 'CUSTOM')
    if (needsCustom) {
      const orgRows = await this.database
        .selectFrom('iam.role_permission_org_scope')
        .select(['role_id', 'org_unit_id'])
        .where('tenant_id', '=', context.tenantId)
        .where('role_id', 'in', activeRoles)
        .where('permission_code', '=', request.permission)
        .execute()
      for (const row of orgRows) {
        const bucket = customOrgByRole.get(row.role_id)
        if (bucket === undefined) customOrgByRole.set(row.role_id, [row.org_unit_id])
        else bucket.push(row.org_unit_id)
      }
    }

    const grants: ScopeGrantInput[] = grantRows.map((row) => ({
      scopeType: row.scope_type as RoleDataScopeType,
      organizationIds: customOrgByRole.get(row.role_id) ?? [],
    }))

    try {
      return await mergeDataScopes(grants, this.organization, context.tenantId, context.userId)
    } catch {
      // Fail closed if organization expansion is unavailable or returns dirty data.
      return deny()
    }
  }

  private async activeRoleIds(tenantId: string, userId: string): Promise<string[]> {
    const user = await this.database
      .selectFrom('iam.user')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', userId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()
    if (user === undefined) return []
    const rows = await this.database
      .selectFrom('iam.user_role as ur')
      .innerJoin('iam.role as r', 'r.id', 'ur.role_id')
      .select('r.id')
      .where('ur.tenant_id', '=', tenantId)
      .where('r.tenant_id', '=', tenantId)
      .where('ur.user_id', '=', userId)
      .where('r.status', '=', 'ACTIVE')
      .execute()
    return rows.map((row) => row.id)
  }
}
