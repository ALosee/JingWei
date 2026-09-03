import type { RouteRecordRaw, RouteRecordSingleView, Router } from 'vue-router'
import { isInternal, type NavigationResponse } from '@jingwei/module-navigation/shared'
import { generatedWebModules } from '../generated/modules.js'
import { layouts, views } from './_generated/imports.js'

type RawComponent = RouteRecordSingleView['component']
const definitions = new Map(generatedWebModules.flatMap(({ manifest }) => manifest.routeDefinitions.map((d) => [d.key, d] as const)))
const bindings = new Map(generatedWebModules.flatMap(({ pages }) => pages.map((p) => [p.routeKey, p.pageKey] as const)))
const pageViews: Readonly<Record<string, RawComponent>> = views
const removals = new WeakMap<Router, (() => void)[]>()

/** Replace the complete dynamic projection, including removed grants and changed paths/layouts. */
export function installDynamicRoutes(router: Router, navigation: NavigationResponse): void {
  const grouped = new Map<'base' | 'blank', RouteRecordRaw[]>()
  for (const node of navigation.nodes) {
    if (!isInternal(node)) continue
    const definition = node.routeKey === null ? undefined : definitions.get(node.routeKey)
    const pageKey = node.routeKey === null ? undefined : bindings.get(node.routeKey)
    const page = pageKey === undefined ? undefined : pageViews[pageKey]
    if (definition === undefined || page === undefined || node.path === null || node.layout === null
      || node.accessMode === null || !definition.allowedAccessModes.includes(node.accessMode)
      || !(definition.allowedLayouts ?? [definition.layout]).includes(node.layout)) {
      throw new Error('Edition page registry cannot resolve navigation ' + node.code)
    }
    const children = grouped.get(node.layout) ?? []
    children.push({ name: definition.key, path: node.path, component: page,
      meta: { navigationCode: node.code, title: node.name, routeKey: node.routeKey, accessMode: node.accessMode } })
    grouped.set(node.layout, children)
  }
  for (const remove of removals.get(router) ?? []) remove()
  const installed: (() => void)[] = []
  for (const [layout, children] of grouped) {
    installed.push(router.addRoute({ name: 'layout:' + layout, path: '/__layout/' + layout,
      component: layouts[layout], children }))
  }
  removals.set(router, installed)
}
