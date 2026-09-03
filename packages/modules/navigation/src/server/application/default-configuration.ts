import { newEntityId } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'
import type { NavigationConfiguration, NavigationNode } from '../../shared/index.js'

/** Explicit initialization template only. Runtime never substitutes it for database failures. */
export function createDefaultConfiguration(registry: ModuleRegistry): NavigationConfiguration {
  const groupId = newEntityId()
  const directoryId = newEntityId()
  const empty: NavigationNode = {
    id: groupId, code: 'workspace', name: '工作区', type: 'GROUP', parentId: null,
    status: 'ENABLED', sortOrder: 0, routeKey: null, path: null, layout: null,
    icon: null, accessMode: null, href: null, externalTarget: null, params: {}, query: {},
  }
  const labels: Readonly<Record<string, string>> = {
    'iam.login': '登录', 'iam.account': '个人账号', 'navigation.manage': '导航管理',
    'organization.units': '组织架构', 'dictionary.entries': '数据字典',
  }
  const nodes: NavigationNode[] = [empty, {
    ...empty, id: directoryId, code: 'administration', name: '系统管理',
    type: 'DIRECTORY', parentId: groupId, sortOrder: 20, icon: 'settings',
  }]
  for (const [index, route] of registry.routes().entries()) {
    const login = route.key === 'iam.login'
    const account = route.key === 'iam.account'
    nodes.push({
      ...empty, id: newEntityId(), code: route.key, name: labels[route.key] ?? route.key,
      type: login ? 'PAGE' : 'MENU', parentId: login ? null : account ? groupId : directoryId,
      routeKey: route.key, path: login ? '/signin' : account ? '/account' : '/' + route.key.replaceAll('.', '/'),
      layout: route.layout, accessMode: route.allowedAccessModes[0], sortOrder: index * 10,
      icon: login ? null : account ? 'user' : 'grid',
    })
  }
  return { authEntryCode: 'iam.login', homeCode: 'iam.account', nodes }
}
