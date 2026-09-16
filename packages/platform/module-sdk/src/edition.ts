import type { ModuleManifest, ModuleNavigationItem } from './manifest.js'

export interface EditionNavigationContainer {
  readonly code: string
  readonly name: string
  readonly type: 'DIRECTORY' | 'GROUP'
  readonly parentCode: string | null
  readonly status?: 'ENABLED' | 'DISABLED'
  readonly sortOrder?: number
  readonly icon?: string | null
}

export interface EditionNavigationDefinition {
  readonly authEntryCode: string
  readonly homeCode: string | null
  readonly containers: readonly EditionNavigationContainer[]
}

export interface ResolvedNavigationDefinition extends EditionNavigationDefinition {
  readonly items: readonly ModuleNavigationItem[]
}

export interface EditionModuleOptions {
  readonly capabilities?: readonly string[]
}

export type EditionModuleSelection = true | EditionModuleOptions

export interface EditionDefinition {
  readonly id: string
  readonly modules: Readonly<Record<string, EditionModuleSelection>>
  readonly navigation?: EditionNavigationDefinition
}

export interface ResolvedModule {
  readonly manifest: ModuleManifest
  readonly enabledCapabilities: ReadonlySet<string>
}

export interface ResolvedEdition {
  readonly id: string
  readonly modules: readonly ResolvedModule[]
  readonly navigation?: ResolvedNavigationDefinition
}

/**
 * Defines a deterministic product Edition.
 *
 * An Edition selects build-time product capabilities; it is not a tenant configuration,
 * permission set, or runtime feature flag. Module existence and capability names are validated
 * later by {@link resolveEdition}, when the module catalog is available.
 */
export function defineEdition<const TEdition extends EditionDefinition>(
  edition: TEdition,
): TEdition {
  if (!/^[a-z][a-z0-9-]*$/u.test(edition.id)) {
    throw new Error(`Invalid edition id: ${edition.id}`)
  }
  return Object.freeze(edition)
}

/**
 * Resolves an Edition into its complete, dependency-first module list.
 *
 * Required dependencies are added transitively. Explicit capability selections are validated
 * against their owner manifest, while an implicit dependency receives all of its capabilities.
 * The result order is stable and safe for server installation, web registration, and migration
 * generation.
 *
 * @throws {Error} For duplicate/unknown modules, dependency cycles, unknown capabilities, or
 * capability-specific module requirements that the Edition does not include.
 */
export function resolveEdition(
  edition: EditionDefinition,
  catalog: readonly ModuleManifest[],
): ResolvedEdition {
  const manifests = new Map(catalog.map((manifest) => [manifest.id, manifest]))
  if (manifests.size !== catalog.length) {
    throw new Error('Module catalog contains duplicate module ids')
  }

  const selected = new Map<string, EditionModuleSelection>(Object.entries(edition.modules))

  for (const moduleId of [...selected.keys()]) {
    includeDependencies(moduleId, selected, manifests, [])
  }

  const orderedIds = topologicalSort([...selected.keys()], manifests)
  const modules = orderedIds.map((moduleId): ResolvedModule => {
    const manifest = requireManifest(moduleId, manifests)
    const selection = selected.get(moduleId)
    if (selection === undefined) {
      throw new Error(`Internal edition resolution error for ${moduleId}`)
    }

    const requested =
      selection === true || selection.capabilities === undefined
        ? manifest.capabilities.map(({ id }) => id)
        : [...selection.capabilities]
    const available = new Set(manifest.capabilities.map(({ id }) => id))

    for (const capability of requested) {
      if (!available.has(capability)) {
        throw new Error(`Edition ${edition.id} enables unknown capability ${capability}`)
      }
      const definition = manifest.capabilities.find(({ id }) => id === capability)
      for (const dependency of definition?.requiresModules ?? []) {
        if (!selected.has(dependency)) {
          throw new Error(
            `Capability ${capability} requires module ${dependency} in edition ${edition.id}`,
          )
        }
      }
    }

    return { manifest, enabledCapabilities: new Set(requested) }
  })

  validateDataScopeProviders(edition.id, modules)
  const navigation = resolveNavigation(edition, modules)
  return { id: edition.id, modules, ...(navigation === undefined ? {} : { navigation }) }
}

function validateDataScopeProviders(editionId: string, modules: readonly ResolvedModule[]): void {
  const providers = new Set<string>()
  for (const module of modules) {
    for (const provider of module.manifest.dataScopeProviders ?? []) {
      if (providers.has(provider.id)) {
        throw new Error(
          `Edition ${editionId} contains duplicate data-scope provider ${provider.id}`,
        )
      }
      providers.add(provider.id)
    }
  }
  for (const module of modules) {
    for (const permission of module.manifest.permissions) {
      const provider = permission.dataScope?.provider
      if (provider !== undefined && !providers.has(provider)) {
        throw new Error(
          `Permission ${permission.code} requires missing data-scope provider ${provider} in edition ${editionId}`,
        )
      }
    }
  }
}

function resolveNavigation(
  edition: EditionDefinition,
  modules: readonly ResolvedModule[],
): ResolvedNavigationDefinition | undefined {
  if (edition.navigation === undefined) return undefined
  const items = modules.flatMap((module) =>
    (module.manifest.navigationItems ?? []).filter((item) => {
      const route = module.manifest.routeDefinitions.find(({ key }) => key === item.routeKey)
      return (
        route !== undefined &&
        (route.requiredCapability === undefined ||
          module.enabledCapabilities.has(route.requiredCapability))
      )
    }),
  )
  const codes = [
    ...edition.navigation.containers.map(({ code }) => code),
    ...items.map(({ code }) => code),
  ]
  if (new Set(codes).size !== codes.length) {
    throw new Error(`Edition ${edition.id} default navigation contains duplicate codes`)
  }
  const available = new Set(codes)
  for (const node of [...edition.navigation.containers, ...items]) {
    if (node.parentCode !== null && !available.has(node.parentCode)) {
      throw new Error(
        `Edition ${edition.id} default navigation parent ${node.parentCode} does not exist`,
      )
    }
  }
  if (!available.has(edition.navigation.authEntryCode)) {
    throw new Error(`Edition ${edition.id} default navigation auth entry does not exist`)
  }
  if (edition.navigation.homeCode !== null && !available.has(edition.navigation.homeCode)) {
    throw new Error(`Edition ${edition.id} default navigation home does not exist`)
  }
  return { ...edition.navigation, items }
}

function includeDependencies(
  moduleId: string,
  selected: Map<string, EditionModuleSelection>,
  manifests: ReadonlyMap<string, ModuleManifest>,
  path: readonly string[],
): void {
  if (path.includes(moduleId)) {
    throw new Error(`Circular module dependency: ${[...path, moduleId].join(' -> ')}`)
  }

  const manifest = requireManifest(moduleId, manifests)
  for (const dependency of manifest.dependencies) {
    if (!selected.has(dependency)) {
      selected.set(dependency, true)
    }
    includeDependencies(dependency, selected, manifests, [...path, moduleId])
  }
}

function topologicalSort(
  selectedIds: readonly string[],
  manifests: ReadonlyMap<string, ModuleManifest>,
): string[] {
  const selected = new Set(selectedIds)
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const result: string[] = []

  const visit = (moduleId: string): void => {
    if (visited.has(moduleId)) return
    if (visiting.has(moduleId)) {
      throw new Error(`Circular module dependency involving ${moduleId}`)
    }
    visiting.add(moduleId)
    const manifest = requireManifest(moduleId, manifests)
    for (const dependency of manifest.dependencies) {
      if (selected.has(dependency)) visit(dependency)
    }
    visiting.delete(moduleId)
    visited.add(moduleId)
    result.push(moduleId)
  }

  for (const moduleId of [...selected].sort()) visit(moduleId)
  return result
}

function requireManifest(
  moduleId: string,
  manifests: ReadonlyMap<string, ModuleManifest>,
): ModuleManifest {
  const manifest = manifests.get(moduleId)
  if (manifest === undefined) {
    throw new Error(`Unknown module: ${moduleId}`)
  }
  return manifest
}
