import {
  navigationTarget,
  resolveNavigationIcon,
  type NavigationNode,
} from '@jingwei/module-navigation/shared'
import type { AppShellMenuItem } from '@jingwei/ui'

/** Keep authorized PAGE nodes in the tree for the shell's native breadcrumb lookup. */
export function createAppShellItems(nodes: readonly NavigationNode[]): AppShellMenuItem[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  function childrenOf(parentId: string | null): AppShellMenuItem[] {
    return nodes
      .filter((node) =>
        parentId === null
          ? node.parentId === null || !byId.has(node.parentId)
          : node.parentId === parentId,
      )
      .toSorted(
        (left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
      )
      .map((node) => {
        const children = childrenOf(node.id)
        const item: AppShellMenuItem = {
          value: node.code,
          label: node.name,
          icon: resolveNavigationIcon(node.icon, node.type),
          hidden: node.type === 'PAGE',
          isGroup: node.type === 'GROUP',
          ...(children.length > 0 ? { children } : {}),
        }
        if (node.type === 'MENU') return { ...item, to: navigationTarget(node) ?? '/__recovery' }
        if (node.type === 'EXTERNAL_LINK')
          return {
            ...item,
            href: node.href ?? '#',
            external: true,
            target: node.externalTarget === 'BLANK' ? '_blank' : '_self',
          }
        if (node.type === 'PAGE') return item
        return children.some((child) => !child.hidden) ? item : { ...item, disabled: true }
      })
  }
  return childrenOf(null)
}
