import { createRoute, type RouteConfig } from '@hono/zod-openapi'

import type { PermissionEvaluationMode, PermissionRequirement } from './authorization.js'
import type { ModuleRegistry } from './registry.js'

export const apiAuthorizationExtension = 'x-jingwei-authorization' as const

export type ApiPermissionScope = PermissionEvaluationMode
export type ApiPermissionRequirement = PermissionRequirement

export type ApiAuthorizationContract =
  | { readonly kind: 'PUBLIC' }
  | { readonly kind: 'AUTHENTICATED' }
  | { readonly kind: 'REFRESH_TOKEN' }
  | {
      readonly kind: 'PERMISSION'
      readonly requirements: readonly [ApiPermissionRequirement, ...ApiPermissionRequirement[]]
    }

export const publicApiAccess = Object.freeze({ kind: 'PUBLIC' } as const)
export const authenticatedApiAccess = Object.freeze({ kind: 'AUTHENTICATED' } as const)
export const refreshTokenApiAccess = Object.freeze({ kind: 'REFRESH_TOKEN' } as const)

export function permissionApiAccess(
  first: ApiPermissionRequirement,
  ...rest: ApiPermissionRequirement[]
): Extract<ApiAuthorizationContract, { kind: 'PERMISSION' }> {
  const requirements: [ApiPermissionRequirement, ...ApiPermissionRequirement[]] = [first, ...rest]
  return Object.freeze({
    kind: 'PERMISSION',
    requirements: Object.freeze(requirements),
  })
}

/**
 * Defines one HTTP route together with its machine-readable authorization contract.
 * The contract is documentation and a fail-fast consistency check; Application remains the
 * enforcement boundary so non-HTTP callers cannot bypass authorization.
 */
export function createApiRoute<const TRoute extends RouteConfig>(
  authorization: ApiAuthorizationContract,
  route: TRoute,
) {
  const hasSecurity = route.security !== undefined && route.security.length > 0
  if (authorization.kind === 'PUBLIC' && hasSecurity) {
    throw new Error(`Public API route ${route.operationId ?? route.path} must not declare security`)
  }
  if (authorization.kind !== 'PUBLIC' && !hasSecurity) {
    throw new Error(
      `Protected API route ${route.operationId ?? route.path} must declare OpenAPI security`,
    )
  }
  return createRoute({
    ...route,
    [apiAuthorizationExtension]: authorization,
  })
}

interface RouteDefinitionLike {
  readonly type: 'route'
  readonly route: Readonly<Record<string, unknown>>
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function routeDefinition(value: unknown): RouteDefinitionLike | null {
  if (!isRecord(value) || value.type !== 'route' || !isRecord(value.route)) return null
  return { type: 'route', route: value.route }
}

function contractOf(value: unknown): ApiAuthorizationContract | null {
  if (!isRecord(value)) return null
  if (value.kind === 'PUBLIC' || value.kind === 'AUTHENTICATED' || value.kind === 'REFRESH_TOKEN') {
    return { kind: value.kind }
  }
  if (value.kind !== 'PERMISSION' || !Array.isArray(value.requirements)) return null
  const requirements: ApiPermissionRequirement[] = []
  for (const requirement of value.requirements) {
    if (
      !isRecord(requirement) ||
      typeof requirement.permission !== 'string' ||
      typeof requirement.capability !== 'string' ||
      (requirement.scope !== 'UNSCOPED' && requirement.scope !== 'SCOPED')
    ) {
      return null
    }
    requirements.push({
      permission: requirement.permission,
      capability: requirement.capability,
      scope: requirement.scope,
    })
  }
  if (requirements.length === 0) return null
  const [first, ...rest] = requirements
  if (first === undefined) return null
  return { kind: 'PERMISSION', requirements: [first, ...rest] }
}

function invalidContract(operation: string, message: string): never {
  throw new Error(`接口授权契约无效：${operation}（${message}）`)
}

/** Fail startup when an enabled business endpoint has a missing or stale authorization contract. */
export function assertApiAuthorizationContracts(
  definitions: readonly unknown[],
  registry: ModuleRegistry,
): void {
  for (const value of definitions) {
    const definition = routeDefinition(value)
    if (definition === null) continue
    const path = typeof definition.route.path === 'string' ? definition.route.path : ''
    if (!path.startsWith('/api/v1/')) continue
    const operation =
      typeof definition.route.operationId === 'string' ? definition.route.operationId : path
    const contract = contractOf(definition.route[apiAuthorizationExtension])
    if (contract === null) invalidContract(operation, 'missing or malformed authorization metadata')
    if (contract.kind !== 'PERMISSION') continue
    for (const requirement of contract.requirements) {
      const permission = registry.permission(requirement.permission)
      if (permission === null) {
        invalidContract(operation, `unknown permission ${requirement.permission}`)
      }
      if (!registry.hasCapability(requirement.capability)) {
        invalidContract(operation, `disabled or unknown capability ${requirement.capability}`)
      }
      const permissionModule = requirement.permission.split('.')[0]
      const capabilityModule = requirement.capability.split('.')[0]
      if (permissionModule !== capabilityModule) {
        invalidContract(
          operation,
          `permission ${requirement.permission} and capability ${requirement.capability} have different owners`,
        )
      }
      const expectedScope: ApiPermissionScope =
        permission.dataScope === undefined ? 'UNSCOPED' : 'SCOPED'
      if (requirement.scope !== expectedScope) {
        invalidContract(
          operation,
          `permission ${requirement.permission} must be declared ${expectedScope}`,
        )
      }
    }
  }
}
