import {
  buildOrganizationTree,
  type OrganizationTreeNode,
  type OrganizationType,
  type OrganizationUnit,
  type OrganizationUnitStatus,
} from '../../shared/index.js'

/** Hierarchical item payload for the platform Tree component. */
export interface OrganizationTreeItemData {
  value: string
  name: string
  code: string
  type: OrganizationType
  status: OrganizationUnitStatus
  children?: OrganizationTreeItemData[]
}

export function toTreeItemData(unit: OrganizationUnit): OrganizationTreeItemData {
  return {
    value: unit.id,
    name: unit.name,
    code: unit.code,
    type: unit.type,
    status: unit.status,
  }
}

export function matchesUnitSearch(
  unit: OrganizationUnit | OrganizationTreeItemData,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return unit.name.toLowerCase().includes(needle) || unit.code.toLowerCase().includes(needle)
}

function branchMatches(tree: OrganizationTreeNode, query: string): boolean {
  return (
    matchesUnitSearch(tree.unit, query) ||
    tree.children.some((child) => branchMatches(child, query))
  )
}

/** Keep self-and-ancestor chains for every match so search results stay navigable. */
export function filterOrganizationTreeItems(
  tree: readonly OrganizationTreeNode[],
  query: string,
): OrganizationTreeItemData[] {
  const walk = (nodes: readonly OrganizationTreeNode[]): OrganizationTreeItemData[] => {
    const result: OrganizationTreeItemData[] = []
    for (const node of nodes) {
      if (!branchMatches(node, query)) continue
      const item = toTreeItemData(node.unit)
      const children = walk(node.children)
      if (children.length > 0) item.children = children
      result.push(item)
    }
    return result
  }
  return walk(tree)
}

export function organizationTreeItemsFromUnits(
  units: readonly OrganizationUnit[],
): OrganizationTreeItemData[] {
  const mapNode = (node: OrganizationTreeNode): OrganizationTreeItemData => {
    const item = toTreeItemData(node.unit)
    if (node.children.length > 0) item.children = node.children.map(mapNode)
    return item
  }
  return buildOrganizationTree(units).map(mapNode)
}

export function collectTreeItemIds(items: readonly OrganizationTreeItemData[]): string[] {
  const ids: string[] = []
  const walk = (nodes: readonly OrganizationTreeItemData[]): void => {
    for (const node of nodes) {
      ids.push(node.value)
      if (node.children !== undefined) walk(node.children)
    }
  }
  walk(items)
  return ids
}
