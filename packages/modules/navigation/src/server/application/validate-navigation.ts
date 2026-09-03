import type { ModuleRegistry } from '@jingwei/module-sdk'
import { isContainer, isInternal, navigationTarget, pathParameters, type NavigationConfiguration } from '../../shared/index.js'

export interface NavigationValidationIssue {
  readonly code: string
  readonly nodeId?: string
  readonly message: string
}

/** Full-snapshot validation, shared by explicit validate, publish, rollback and runtime loading. */
export function validateNavigation(config: NavigationConfiguration, registry: ModuleRegistry): NavigationValidationIssue[] {
  const issues: NavigationValidationIssue[] = []
  const byId = new Map(config.nodes.map((node) => [node.id, node]))
  const codes = new Set<string>()
  const routes = new Set<string>()
  const paths: string[][] = []
  const add = (code: string, nodeId: string, message: string) => { issues.push({ code, nodeId, message }) }
  if (byId.size !== config.nodes.length) issues.push({ code: 'NAVIGATION_ID_DUPLICATE', message: '节点 ID 重复' })
  for (const node of config.nodes) {
    if (codes.has(node.code)) add('NAVIGATION_CODE_DUPLICATE', node.id, 'code 在版本内必须唯一')
    codes.add(node.code)
    if (node.parentId !== null) {
      const parent = byId.get(node.parentId)
      if (parent === undefined) add('NAVIGATION_PARENT_MISSING', node.id, '父节点不存在')
      else if (!isContainer(parent) && !(node.type === 'PAGE' && isInternal(parent))) {
        add('NAVIGATION_PARENT_INVALID', node.id, '只有容器可包含菜单，内部页面仅可挂隐藏子页面')
      }
    }
    const seen = new Set<string>()
    let ancestor: string | null = node.id
    while (ancestor !== null) {
      if (seen.has(ancestor)) { add('NAVIGATION_CYCLE', node.id, '父链存在循环'); break }
      seen.add(ancestor)
      ancestor = byId.get(ancestor)?.parentId ?? null
    }
    if (isContainer(node)) {
      if ([node.routeKey, node.path, node.layout, node.href, node.accessMode, node.externalTarget].some((value) => value !== null)
        || Object.keys(node.params).length > 0 || Object.keys(node.query).length > 0) {
        add('NAVIGATION_CONTAINER_TARGET', node.id, '目录/分组不能设置路由、参数、外链或独立访问模式')
      }
      continue
    }
    if (node.accessMode === null) add('NAVIGATION_ACCESS_MODE_REQUIRED', node.id, '必须选择访问模式')
    if (node.type === 'EXTERNAL_LINK') {
      let safe = false
      try {
        const url = new URL(node.href ?? '')
        safe = url.protocol === 'https:' && url.username === '' && url.password === ''
      } catch { /* Invalid URLs are rejected below. */ }
      if (!safe) add('NAVIGATION_EXTERNAL_URL_INVALID', node.id, '外链必须是无内嵌凭据的 HTTPS URL')
      if (node.routeKey !== null || node.path !== null || node.layout !== null || node.externalTarget === null
        || Object.keys(node.params).length > 0 || Object.keys(node.query).length > 0) {
        add('NAVIGATION_EXTERNAL_FIELDS', node.id, '外链只能设置 href/target，不得混入内部路由字段')
      }
      continue
    }
    if (node.href !== null || node.externalTarget !== null) add('NAVIGATION_INTERNAL_FIELDS', node.id, '内部页面不能设置外链')
    const definition = node.routeKey === null ? null : registry.route(node.routeKey)
    if (definition === null) add('NAVIGATION_ROUTE_UNKNOWN', node.id, 'routeKey 不在当前 Edition')
    else {
      if (routes.has(definition.key)) add('NAVIGATION_ROUTE_DUPLICATE', node.id, '一个版本只能挂载一次 routeKey')
      routes.add(definition.key)
      if (node.accessMode === null || !definition.allowedAccessModes.includes(node.accessMode)) {
        add('NAVIGATION_ACCESS_MODE_FORBIDDEN', node.id, '访问模式超出模块声明范围')
      }
      if (node.layout === null || !(definition.allowedLayouts ?? [definition.layout]).includes(node.layout)) {
        add('NAVIGATION_LAYOUT_FORBIDDEN', node.id, '布局超出模块声明范围')
      }
      if (definition.requiredCapability !== undefined && !registry.hasCapability(definition.requiredCapability)) {
        add('NAVIGATION_CAPABILITY_DISABLED', node.id, '页面能力未启用')
      }
      if (definition.requiredPermission !== undefined && registry.permission(definition.requiredPermission) === null) {
        add('NAVIGATION_PERMISSION_UNKNOWN', node.id, '模块功能权限未注册')
      }
    }
    const parameters = node.path === null ? null : pathParameters(node.path)
    if (parameters === null || node.path?.startsWith('/__')) {
      add('NAVIGATION_PATH_INVALID', node.id, '路径必须为非保留绝对路径；只允许普通参数和末尾可选参数')
      continue
    }
    const segments = (node.path ?? '').toLowerCase().slice(1).split('/')
    const alternatives = segments.at(-1)?.endsWith('?') ? [segments, segments.slice(0, -1)] : [segments]
    for (const candidate of alternatives) {
      if (paths.some((other) => other.length === candidate.length && other.every(
        (segment, index) => segment === candidate[index] || segment.startsWith(':') || candidate[index]?.startsWith(':'),
      ))) add('NAVIGATION_PATH_COLLISION', node.id, '路径匹配范围与其他节点冲突')
    }
    paths.push(...alternatives)
    for (const key of Object.keys(node.params)) {
      if (!parameters.some((parameter) => parameter.name === key)) add('NAVIGATION_PARAM_UNKNOWN', node.id, '默认参数不在路径中: ' + key)
      if (node.params[key] === '.' || node.params[key] === '..') add('NAVIGATION_PARAM_INVALID', node.id, '默认参数不能是路径跳转片段: ' + key)
    }
    if (node.type === 'MENU' && navigationTarget(node) === null) add('NAVIGATION_PARAMS_REQUIRED', node.id, '菜单必须提供全部必填路径参数')
  }
  for (const [code, isAuth] of [[config.authEntryCode, true], [config.homeCode, false]] as const) {
    if (code === null) continue
    const node = config.nodes.find((item) => item.code === code)
    let enabled = node?.status === 'ENABLED'
    const seen = new Set<string>()
    let parent = node?.parentId ?? null
    while (parent !== null && !seen.has(parent)) {
      seen.add(parent)
      const item = byId.get(parent)
      enabled = enabled && item?.status === 'ENABLED'
      parent = item?.parentId ?? null
    }
    if (node === undefined || !isInternal(node) || !enabled || navigationTarget(node) === null
      || (isAuth && node.accessMode !== 'PUBLIC')) {
      issues.push({ code: isAuth ? 'NAVIGATION_AUTH_ENTRY_INVALID' : 'NAVIGATION_HOME_INVALID',
        message: '入口必须指向启用、可直接跳转的内部页面；登录入口必须 PUBLIC' })
    }
  }
  return issues
}
