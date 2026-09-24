import type { ResolvedEdition, ResolvedNavigationDefinition } from './edition.js'
import type { PermissionDefinition, RouteDefinition } from './manifest.js'

/** Permission as exposed by the resolved edition, including its owner module. */
export interface CatalogPermission extends PermissionDefinition {
  readonly moduleId: string
}

/**
 * Read-only runtime projection of a resolved Edition.
 *
 * The registry answers product-availability questions. In particular, `hasCapability()` does
 * not authorize the current user, and this class must not become a service locator for module
 * repositories or use cases.
 */
export class ModuleRegistry {
  readonly #edition: ResolvedEdition
  readonly #routes = new Map<string, RouteDefinition>()
  readonly #permissions = new Map<string, PermissionDefinition>()

  /** @throws {Error} If route keys or permission codes collide across enabled modules. */
  constructor(edition: ResolvedEdition) {
    this.#edition = edition
    for (const module of edition.modules) {
      for (const route of module.manifest.routeDefinitions) {
        if (this.#routes.has(route.key)) throw new Error(`Duplicate route key: ${route.key}`)
        this.#routes.set(route.key, route)
      }
      for (const permission of module.manifest.permissions) {
        if (this.#permissions.has(permission.code)) {
          throw new Error(`Duplicate permission: ${permission.code}`)
        }
        this.#permissions.set(permission.code, permission)
      }
    }
  }

  get editionId(): string {
    return this.#edition.id
  }

  hasModule(moduleId: string): boolean {
    return this.#edition.modules.some(({ manifest }) => manifest.id === moduleId)
  }

  moduleName(moduleId: string): string | null {
    return (
      this.#edition.modules.find(({ manifest }) => manifest.id === moduleId)?.manifest.name ?? null
    )
  }

  hasCapability(capabilityId: string): boolean {
    return this.#edition.modules.some(({ enabledCapabilities }) =>
      enabledCapabilities.has(capabilityId),
    )
  }

  route(routeKey: string): RouteDefinition | null {
    return this.#routes.get(routeKey) ?? null
  }

  permission(permissionCode: string): PermissionDefinition | null {
    return this.#permissions.get(permissionCode) ?? null
  }

  routes(): readonly RouteDefinition[] {
    return [...this.#routes.values()]
  }

  permissions(): readonly CatalogPermission[] {
    const permissions: CatalogPermission[] = []
    for (const module of this.#edition.modules) {
      for (const permission of module.manifest.permissions) {
        permissions.push({
          code: permission.code,
          name: permission.name,
          moduleId: module.manifest.id,
          ...(permission.dataScope === undefined ? {} : { dataScope: permission.dataScope }),
        })
      }
    }
    return permissions
  }

  defaultNavigation(): ResolvedNavigationDefinition | null {
    return this.#edition.navigation ?? null
  }
}
