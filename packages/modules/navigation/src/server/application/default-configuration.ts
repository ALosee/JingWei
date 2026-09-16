import { newEntityId } from '@jingwei/kernel'
import type { ModuleRegistry, NavigationPresetQueryValue } from '@jingwei/module-sdk'

import type { NavigationConfiguration, NavigationNode } from '../../shared/index.js'

/** Explicit initialization template only. Runtime never substitutes it for database failures. */
export function createDefaultConfiguration(registry: ModuleRegistry): NavigationConfiguration {
  const preset = registry.defaultNavigation()
  if (preset === null) throw new Error('Edition does not define a default navigation preset')
  const ids = new Map(
    [...preset.containers, ...preset.items].map(({ code }) => [code, newEntityId()]),
  )
  const parentId = (parentCode: string | null): string | null => {
    if (parentCode === null) return null
    const id = ids.get(parentCode)
    if (id === undefined) throw new Error(`Default navigation parent not found: ${parentCode}`)
    return id
  }
  const containers: NavigationNode[] = preset.containers.map((container) => ({
    id: requiredId(ids, container.code),
    code: container.code,
    name: container.name,
    type: container.type,
    parentId: parentId(container.parentCode),
    status: container.status ?? 'ENABLED',
    sortOrder: container.sortOrder ?? 0,
    routeKey: null,
    path: null,
    layout: null,
    icon: container.icon ?? null,
    accessMode: null,
    href: null,
    externalTarget: null,
    params: {},
    query: {},
  }))
  const items: NavigationNode[] = preset.items.map((item) => {
    const route = registry.route(item.routeKey)
    if (route === null) throw new Error(`Default navigation route not found: ${item.routeKey}`)
    return {
      id: requiredId(ids, item.code),
      code: item.code,
      name: item.name,
      type: item.type,
      parentId: parentId(item.parentCode),
      status: item.status ?? 'ENABLED',
      sortOrder: item.sortOrder ?? 0,
      routeKey: item.routeKey,
      path: item.path,
      layout: item.layout ?? route.layout,
      icon: item.icon ?? null,
      accessMode: item.accessMode ?? route.allowedAccessModes[0],
      href: null,
      externalTarget: null,
      params: { ...(item.params ?? {}) },
      query: Object.fromEntries(
        Object.entries(item.query ?? {}).map(([key, value]) => [
          key,
          isQueryArray(value) ? [...value] : value,
        ]),
      ),
    }
  })
  return {
    authEntryCode: preset.authEntryCode,
    homeCode: preset.homeCode,
    nodes: [...containers, ...items],
  }
}

function isQueryArray(
  value: NavigationPresetQueryValue,
): value is readonly (string | number | boolean)[] {
  return Array.isArray(value)
}

function requiredId(ids: ReadonlyMap<string, string>, code: string): string {
  const id = ids.get(code)
  if (id === undefined) throw new Error(`Default navigation node not found: ${code}`)
  return id
}
