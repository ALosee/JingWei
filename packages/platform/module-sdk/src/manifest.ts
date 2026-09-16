export const accessModes = ['PUBLIC', 'AUTHENTICATED', 'PERMISSION'] as const
export type AccessMode = (typeof accessModes)[number]

export const permissionDataScopeTypes = [
  'ALL',
  'ORGANIZATION',
  'ORGANIZATION_AND_DESCENDANTS',
  'SELF',
  'CUSTOM',
] as const
export type PermissionDataScopeType = (typeof permissionDataScopeTypes)[number]

export const moduleCategories = ['platform', 'foundation', 'business', 'extension'] as const
export type ModuleCategory = (typeof moduleCategories)[number]

export interface CapabilityDefinition {
  readonly id: string
  readonly name: string
  readonly requiresModules?: readonly string[]
}

/** A statically declared owner for facts needed to evaluate provider-backed data scopes. */
export interface DataScopeProviderDefinition {
  readonly id: string
}

export interface PermissionDataScopeDefinition {
  readonly allowedTypes: readonly [PermissionDataScopeType, ...PermissionDataScopeType[]]
  readonly provider?: string
}

export interface PermissionDefinition {
  readonly code: string
  readonly name: string
  /** Omission means this permission only accepts ALL. */
  readonly dataScope?: PermissionDataScopeDefinition
}

export type NavigationPresetScalar = string | number | boolean | null
export type NavigationPresetQueryValue =
  | NavigationPresetScalar
  | readonly Exclude<NavigationPresetScalar, null>[]

/** Module-owned suggestion only; the Edition decides shared containers and entry points. */
export interface ModuleNavigationItem {
  readonly code: string
  readonly name: string
  readonly type: 'MENU' | 'PAGE'
  readonly parentCode: string | null
  readonly routeKey: string
  readonly path: string
  readonly layout?: 'base' | 'blank'
  readonly accessMode?: AccessMode
  readonly status?: 'ENABLED' | 'DISABLED'
  readonly sortOrder?: number
  readonly icon?: string | null
  readonly params?: Readonly<Record<string, string | number>>
  readonly query?: Readonly<Record<string, NavigationPresetQueryValue>>
}

export interface RouteDefinition {
  readonly key: string
  readonly page: string
  readonly layout: 'base' | 'blank'
  /** Database layout selection is constrained by this list; omission allows only the default. */
  readonly allowedLayouts?: readonly ('base' | 'blank')[]
  readonly allowedAccessModes: readonly [AccessMode, ...AccessMode[]]
  readonly requiredCapability?: string
  readonly requiredPermission?: string
}

export interface ModuleManifest {
  readonly id: string
  readonly name: string
  readonly category: ModuleCategory
  readonly dependencies: readonly string[]
  readonly optionalDependencies: readonly string[]
  readonly capabilities: readonly CapabilityDefinition[]
  readonly dataScopeProviders?: readonly DataScopeProviderDefinition[]
  readonly permissions: readonly PermissionDefinition[]
  readonly routeDefinitions: readonly RouteDefinition[]
  readonly navigationItems?: readonly ModuleNavigationItem[]
}

const moduleIdPattern = /^[a-z][a-z0-9-]*$/u

/**
 * Defines and validates the static contract of one business module.
 *
 * Manifests are build inputs: they must remain deterministic and free of runtime side effects
 * such as reading environment variables, opening database connections, or importing UI pages.
 * The returned object is shallow-frozen; nested arrays should therefore also be treated as
 * immutable by every caller.
 *
 * @throws {Error} When ids, ownership prefixes, references, or uniqueness rules are invalid.
 */
export function defineModule<const TManifest extends ModuleManifest>(
  manifest: TManifest,
): TManifest {
  validateManifest(manifest)
  return Object.freeze(manifest)
}

/**
 * Checks the invariants that make manifests safe to merge into an Edition registry.
 *
 * This validates references inside one manifest. Cross-module concerns such as missing modules,
 * dependency cycles, and duplicate permissions across modules are checked by Edition resolution
 * and {@link ModuleRegistry}.
 */
export function validateManifest(manifest: ModuleManifest): void {
  if (!moduleIdPattern.test(manifest.id)) {
    throw new Error(`Invalid module id: ${manifest.id}`)
  }

  ensureUnique(
    `${manifest.id} capability`,
    manifest.capabilities.map(({ id }) => id),
  )
  ensureUnique(
    `${manifest.id} data-scope provider`,
    (manifest.dataScopeProviders ?? []).map(({ id }) => id),
  )
  ensureUnique(
    `${manifest.id} permission`,
    manifest.permissions.map(({ code }) => code),
  )
  ensureUnique(
    `${manifest.id} route`,
    manifest.routeDefinitions.map(({ key }) => key),
  )
  ensureUnique(`${manifest.id} dependency`, [
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  ])

  const capabilities = new Set(manifest.capabilities.map(({ id }) => id))
  const permissions = new Set(manifest.permissions.map(({ code }) => code))

  for (const permission of permissions) {
    if (!permission.startsWith(`${manifest.id}.`)) {
      throw new Error(`Permission ${permission} must be owned by module ${manifest.id}`)
    }
  }

  for (const permission of manifest.permissions) {
    const dataScope = permission.dataScope
    if (dataScope === undefined) continue
    ensureUnique(`${permission.code} data-scope type`, dataScope.allowedTypes)
    if (dataScope.allowedTypes.length === 0) {
      throw new Error(`Permission ${permission.code} must allow at least one data-scope type`)
    }
    if (!dataScope.allowedTypes.includes('ALL')) {
      throw new Error(`Permission ${permission.code} data scopes must include ALL`)
    }
    const needsProvider = dataScope.allowedTypes.some((type) =>
      ['ORGANIZATION', 'ORGANIZATION_AND_DESCENDANTS', 'CUSTOM'].includes(type),
    )
    if (needsProvider && dataScope.provider === undefined) {
      throw new Error(`Permission ${permission.code} requires a data-scope provider`)
    }
    if (dataScope.provider !== undefined && !moduleIdPattern.test(dataScope.provider)) {
      throw new Error(`Permission ${permission.code} has invalid provider ${dataScope.provider}`)
    }
  }

  for (const route of manifest.routeDefinitions) {
    if (route.allowedLayouts !== undefined && !route.allowedLayouts.includes(route.layout)) {
      throw new Error(`Route ${route.key} default layout must be allowed`)
    }
    if (!route.key.startsWith(`${manifest.id}.`)) {
      throw new Error(`Route ${route.key} must be owned by module ${manifest.id}`)
    }
    if (route.requiredCapability !== undefined && !capabilities.has(route.requiredCapability)) {
      throw new Error(`Route ${route.key} requires unknown capability ${route.requiredCapability}`)
    }
    if (route.requiredPermission !== undefined && !permissions.has(route.requiredPermission)) {
      throw new Error(`Route ${route.key} requires unknown permission ${route.requiredPermission}`)
    }
    if (route.requiredPermission !== undefined && route.allowedAccessModes.includes('PUBLIC')) {
      throw new Error(`Permission route ${route.key} cannot allow PUBLIC access`)
    }
  }

  const routes = new Map(manifest.routeDefinitions.map((route) => [route.key, route]))
  ensureUnique(
    `${manifest.id} navigation code`,
    (manifest.navigationItems ?? []).map(({ code }) => code),
  )
  ensureUnique(
    `${manifest.id} navigation route`,
    (manifest.navigationItems ?? []).map(({ routeKey }) => routeKey),
  )
  for (const item of manifest.navigationItems ?? []) {
    const route = routes.get(item.routeKey)
    if (route === undefined) {
      throw new Error(`Navigation item ${item.code} references unknown route ${item.routeKey}`)
    }
    if (
      item.layout !== undefined &&
      !(route.allowedLayouts ?? [route.layout]).includes(item.layout)
    ) {
      throw new Error(`Navigation item ${item.code} uses a forbidden layout`)
    }
    if (item.accessMode !== undefined && !route.allowedAccessModes.includes(item.accessMode)) {
      throw new Error(`Navigation item ${item.code} uses a forbidden access mode`)
    }
  }
}

function ensureUnique(label: string, values: readonly string[]): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`)
    }
    seen.add(value)
  }
}
