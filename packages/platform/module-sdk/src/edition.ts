import type { ModuleManifest } from './manifest.js'

export interface EditionModuleOptions {
  readonly capabilities?: readonly string[]
}

export type EditionModuleSelection = true | EditionModuleOptions

export interface EditionDefinition {
  readonly id: string
  readonly modules: Readonly<Record<string, EditionModuleSelection>>
}

export interface ResolvedModule {
  readonly manifest: ModuleManifest
  readonly enabledCapabilities: ReadonlySet<string>
}

export interface ResolvedEdition {
  readonly id: string
  readonly modules: readonly ResolvedModule[]
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

  return { id: edition.id, modules }
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
