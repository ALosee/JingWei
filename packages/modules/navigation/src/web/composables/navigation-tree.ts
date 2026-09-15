import { isContainer, isInternal, type NavigationNode } from '../../shared/index.js'

export interface NavigationTreeNode {
  node: NavigationNode
  children: NavigationTreeNode[]
  depth: number
}

export interface NavigationTreeRow {
  node: NavigationNode
  depth: number
  expanded: boolean
  childCount: number
  hasChildren: boolean
}

export function compareNodes(left: NavigationNode, right: NavigationNode): number {
  return left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
}

export function buildNavigationTree(nodes: readonly NavigationNode[]): NavigationTreeNode[] {
  const byParent = new Map<string | null, NavigationNode[]>()
  for (const node of nodes) {
    const bucket = byParent.get(node.parentId)
    if (bucket === undefined) byParent.set(node.parentId, [node])
    else bucket.push(node)
  }
  const build = (parentId: string | null, depth: number): NavigationTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .toSorted(compareNodes)
      .map((node) => ({ node, depth, children: build(node.id, depth + 1) }))
  return build(null, 0)
}

export function matchesNodeSearch(node: NavigationNode, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    node.name.toLowerCase().includes(needle) ||
    node.code.toLowerCase().includes(needle) ||
    (node.routeKey ?? '').toLowerCase().includes(needle) ||
    (node.path ?? '').toLowerCase().includes(needle) ||
    (node.href ?? '').toLowerCase().includes(needle)
  )
}

function branchMatches(
  node: NavigationNode,
  children: NavigationTreeNode[],
  query: string,
): boolean {
  return matchesNodeSearch(node, query) || children.some((child) => branchMatchesNode(child, query))
}

function branchMatchesNode(tree: NavigationTreeNode, query: string): boolean {
  return branchMatches(tree.node, tree.children, query)
}

export function flattenNavigationTree(
  tree: readonly NavigationTreeNode[],
  expandedIds: ReadonlySet<string>,
  query: string,
): NavigationTreeRow[] {
  const rows: NavigationTreeRow[] = []
  const walk = (nodes: readonly NavigationTreeNode[], parentVisible: boolean): void => {
    for (const item of nodes) {
      if (!parentVisible && !branchMatchesNode(item, query)) continue
      const hasChildren = item.children.length > 0
      const expanded = query.trim() !== '' ? true : expandedIds.has(item.node.id)
      rows.push({
        node: item.node,
        depth: item.depth,
        expanded,
        childCount: item.children.length,
        hasChildren,
      })
      if (hasChildren && expanded) walk(item.children, true)
    }
  }
  walk(tree, false)
  return rows
}

export function collectDescendantIds(
  nodes: readonly NavigationNode[],
  rootId: string,
): Set<string> {
  const children = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const bucket = children.get(node.parentId)
    if (bucket === undefined) children.set(node.parentId, [node.id])
    else bucket.push(node.id)
  }
  const result = new Set<string>()
  const stack = [rootId]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) continue
    for (const child of children.get(current) ?? []) {
      if (result.has(child)) continue
      result.add(child)
      stack.push(child)
    }
  }
  return result
}

export function canNestNode(
  nodes: readonly NavigationNode[],
  childId: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true
  if (parentId === childId) return false
  const child = nodes.find((node) => node.id === childId)
  const parent = nodes.find((node) => node.id === parentId)
  if (child === undefined || parent === undefined) return false
  if (collectDescendantIds(nodes, childId).has(parentId)) return false
  if (isContainer(parent)) return true
  return child.type === 'PAGE' && isInternal(parent)
}

export function parentOptionsFor(
  nodes: readonly NavigationNode[],
  selected: NavigationNode,
): { id: string | null; label: string; depth: number }[] {
  const tree = buildNavigationTree(nodes)
  const options: { id: string | null; label: string; depth: number }[] = [
    { id: null, label: '根节点', depth: 0 },
  ]
  const walk = (items: readonly NavigationTreeNode[]): void => {
    for (const item of items) {
      if (item.node.id !== selected.id && canNestNode(nodes, selected.id, item.node.id)) {
        options.push({
          id: item.node.id,
          label: `${item.node.name} · ${item.node.code}`,
          depth: item.depth,
        })
      }
      walk(item.children)
    }
  }
  walk(tree)
  return options
}

export function nextSortOrder(nodes: readonly NavigationNode[], parentId: string | null): number {
  const siblings = nodes.filter((node) => node.parentId === parentId)
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((node) => node.sortOrder)) + 1
}

export function uniqueCode(nodes: readonly NavigationNode[], base: string): string {
  const taken = new Set(nodes.map((node) => node.code))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

export function defaultExpandedIds(nodes: readonly NavigationNode[]): Set<string> {
  const tree = buildNavigationTree(nodes)
  const result = new Set<string>()
  const walk = (items: readonly NavigationTreeNode[], depth: number): void => {
    if (depth > 2) return
    for (const item of items) {
      if (item.children.length > 0) result.add(item.node.id)
      walk(item.children, depth + 1)
    }
  }
  walk(tree, 0)
  return result
}
