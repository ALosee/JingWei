import type { AuthContext } from '@jingwei/kernel'

export const dataScopeTypes = [
  'ALL',
  'ORGANIZATION',
  'ORGANIZATION_AND_DESCENDANTS',
  'SELF',
  'CUSTOM',
] as const

export type DataScopeType = (typeof dataScopeTypes)[number]

export interface DataScopeGrant {
  readonly type: DataScopeType
  readonly organizationIds: readonly string[]
}

export interface AuthorizationRequest {
  readonly context: AuthContext
  readonly capability: string
  readonly permission: string
}

export interface AuthorizationDecision {
  readonly allowed: boolean
  readonly dataScope: DataScopeGrant | null
}

/** Public port for allow-only RBAC. Implementations must union role grants and never infer access from menus. */
export interface AuthorizationEvaluator {
  evaluate(request: AuthorizationRequest): Promise<AuthorizationDecision>
}
