import {
  navigationTarget,
  resolveNavigationIcon,
  type NavigationNode,
} from '@jingwei/module-navigation/shared'

export { resolveNavigationIcon }

export interface SearchableNavigationItem {
  readonly node: NavigationNode
  readonly label: string
  readonly target: string
}

export function childNavigationNodes(
  nodes: readonly NavigationNode[],
  parentId: string | null,
): NavigationNode[] {
  return nodes
    .filter((node) => node.parentId === parentId && node.type !== 'PAGE')
    .toSorted((left, right) => left.sortOrder - right.sortOrder)
}

export function navigationBreadcrumbs(
  nodes: readonly NavigationNode[],
  navigationCode: unknown,
): NavigationNode[] {
  if (typeof navigationCode !== 'string') return []
  const byId = new Map(nodes.map((node) => [node.id, node] as const))
  const current = nodes.find((node) => node.code === navigationCode)
  if (current === undefined) return []

  const result: NavigationNode[] = []
  const visited = new Set<string>()
  let cursor: NavigationNode | undefined = current
  while (cursor !== undefined && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    result.unshift(cursor)
    cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId)
  }
  return result
}

export function activeNavigationMenuCode(
  nodes: readonly NavigationNode[],
  navigationCode: unknown,
): string {
  const breadcrumbs = navigationBreadcrumbs(nodes, navigationCode)
  return breadcrumbs.findLast((node) => node.type === 'MENU')?.code ?? ''
}

export function searchableNavigationItems(
  nodes: readonly NavigationNode[],
): SearchableNavigationItem[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'MENU' && node.type !== 'EXTERNAL_LINK') return []
    const target = node.type === 'MENU' ? navigationTarget(node) : node.href
    if (target === null) return []
    const ancestors = navigationBreadcrumbs(nodes, node.code)
    return [{ node, target, label: ancestors.map((item) => item.name).join(' / ') }]
  })
}

export function containsActiveNavigation(
  nodes: readonly NavigationNode[],
  node: NavigationNode,
  activeCode: unknown,
): boolean {
  if (typeof activeCode !== 'string') return false
  if (node.code === activeCode) return true
  const children = childNavigationNodes(nodes, node.id)
  return children.some((child) => containsActiveNavigation(nodes, child, activeCode))
}
