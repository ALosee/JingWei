import { isContainer, type NavigationNode } from '../../shared/index.js'

export type PreviewPerspective = 'public' | 'authenticated' | 'role'

/** Client-side mirror of server projectNodes for admin preview only. */
export function projectSidebarPreview(
  nodes: readonly NavigationNode[],
  perspective: PreviewPerspective,
  grantedCodes: ReadonlySet<string> = new Set(),
): NavigationNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const enabled = (node: NavigationNode): boolean => {
    let current: NavigationNode | undefined = node
    const seen = new Set<string>()
    while (current !== undefined) {
      if (current.status !== 'ENABLED' || seen.has(current.id)) return false
      seen.add(current.id)
      current = current.parentId === null ? undefined : byId.get(current.parentId)
    }
    return true
  }
  const authenticated = perspective !== 'public'
  const allowed = nodes.filter(
    (node) =>
      !isContainer(node) &&
      enabled(node) &&
      (node.accessMode === 'PUBLIC' ||
        (authenticated &&
          (node.accessMode === 'AUTHENTICATED' ||
            (perspective === 'role' &&
              node.accessMode === 'PERMISSION' &&
              grantedCodes.has(node.code))))),
  )
  const kept = new Set(allowed.map((node) => node.id))
  for (const node of allowed.filter((item) => item.type !== 'PAGE')) {
    let parent = node.parentId === null ? undefined : byId.get(node.parentId)
    while (parent !== undefined) {
      if (isContainer(parent)) kept.add(parent.id)
      parent = parent.parentId === null ? undefined : byId.get(parent.parentId)
    }
  }
  return nodes
    .filter((node) => kept.has(node.id))
    .map((node) => {
      let parentId = node.parentId
      while (parentId !== null && !kept.has(parentId))
        parentId = byId.get(parentId)?.parentId ?? null
      return { ...node, parentId }
    })
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}

export function sidebarVisibleNodes(nodes: readonly NavigationNode[]): NavigationNode[] {
  return nodes.filter((node) => node.type !== 'PAGE')
}
