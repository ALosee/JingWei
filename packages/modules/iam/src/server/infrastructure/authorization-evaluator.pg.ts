import type { Kysely } from 'kysely'

import { ApplicationError } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'
import type { AppLogger } from '@jingwei/observability'

import type { RoleDataScopeType } from '../../shared/index.js'
import {
  InvalidDataScopeGrantError,
  mergeDataScopes,
  type ScopeGrantInput,
} from '../application/merge-data-scopes.js'
import type {
  AuthorizationEvaluator,
  AuthorizationRequest,
  DataScopeGrant,
  OrganizationalScopeFacts,
} from '../public/authorization.js'
import { observeAuthorization } from './authorization-telemetry.js'

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
    private readonly logger?: AppLogger,
  ) {}

  async requireScopedPermission(request: AuthorizationRequest): Promise<DataScopeGrant> {
    return observeAuthorization({
      logger: this.logger,
      context: request.context,
      permission: request.requirement.permission,
      evaluator: 'SCOPED',
      evaluate: () => this.evaluate(request),
    })
  }

  private async evaluate(request: AuthorizationRequest): Promise<DataScopeGrant> {
    const { requirement } = request
    const definition = this.registry.permission(requirement.permission)
    if (definition === null || !this.registry.hasCapability(requirement.capability)) return deny()
    if (definition.dataScope === undefined) {
      throw new ApplicationError({
        code: 'AUTHZ_UNSCOPED_PERMISSION_REQUIRES_ACCESS',
        message: '无数据范围的权限必须通过基础权限入口校验',
        status: 500,
      })
    }

    const { context } = request
    const grantRows = await this.database
      .selectFrom('iam.user as u')
      .innerJoin('iam.user_role as ur', (join) =>
        join.onRef('ur.user_id', '=', 'u.id').onRef('ur.tenant_id', '=', 'u.tenant_id'),
      )
      .innerJoin('iam.role as r', (join) =>
        join.onRef('r.id', '=', 'ur.role_id').onRef('r.tenant_id', '=', 'ur.tenant_id'),
      )
      .innerJoin('iam.role_permission as rp', (join) =>
        join.onRef('rp.role_id', '=', 'r.id').onRef('rp.tenant_id', '=', 'r.tenant_id'),
      )
      .select(['rp.role_id', 'rp.scope_type'])
      .where('u.tenant_id', '=', context.tenantId)
      .where('u.id', '=', context.userId)
      .where('u.status', '=', 'ACTIVE')
      .where('r.status', '=', 'ACTIVE')
      .where('rp.permission_code', '=', requirement.permission)
      .execute()
    if (grantRows.length === 0) return deny()
    const activeRoles = grantRows.map((row) => row.role_id)

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
        .where('permission_code', '=', requirement.permission)
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
    } catch (error) {
      // Invalid persisted scope data denies access; infrastructure failures keep their real 500 path.
      if (error instanceof InvalidDataScopeGrantError) return deny()
      throw error
    }
  }
}
