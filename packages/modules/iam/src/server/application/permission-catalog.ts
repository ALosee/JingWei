import type { ModuleRegistry } from '@jingwei/module-sdk'

import type { PermissionCatalog, PermissionCatalogItem } from '../../shared/index.js'

/** Read-only projection of enabled edition permissions for role assignment UI. */
export class ReadPermissionCatalog {
  constructor(private readonly registry: ModuleRegistry) {}

  list(): PermissionCatalog {
    const permissions: PermissionCatalogItem[] = this.registry
      .permissions()
      .map((permission) => ({
        code: permission.code,
        moduleId: permission.moduleId,
        name: permission.name,
        supportsDataScope: permission.supportsDataScope ?? false,
      }))
      .toSorted((left, right) =>
        left.moduleId === right.moduleId
          ? left.code.localeCompare(right.code)
          : left.moduleId.localeCompare(right.moduleId),
      )
    return { permissions }
  }
}
