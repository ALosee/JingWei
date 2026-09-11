import type { NavigationNode } from '@jingwei/module-navigation/shared'
import { navigationTarget } from '@jingwei/module-navigation/shared'
import type { MenubarProps, TreeMenuProps } from '@jingwei/ui'

import { childNavigationNodes, resolveNavigationIcon } from '../../../../navigation/presentation.js'

export type SiderMenuItem = TreeMenuProps['items'][number]
export type HeaderMenuItem = MenubarProps<string>['items'][number]

export function createSiderMenuItems(
  nodes: readonly NavigationNode[],
  parentId: string | null = null,
): SiderMenuItem[] {
  return childNavigationNodes(nodes, parentId).map((node) => {
    const children = createSiderMenuItems(nodes, node.id)
    const common = {
      value: node.code,
      label: node.name,
      icon: resolveNavigationIcon(node.icon, node.type),
    }

    if (children.length > 0) {
      return { ...common, children, isGroup: node.type === 'GROUP' }
    }
    if (node.type === 'MENU') return { ...common, to: navigationTarget(node) ?? '/__recovery' }
    if (node.type === 'EXTERNAL_LINK') {
      return {
        ...common,
        href: node.href ?? '#',
        external: true,
        target: node.externalTarget === 'BLANK' ? '_blank' : '_self',
      }
    }
    return { ...common, disabled: true }
  })
}

export function createHeaderMenuItems(
  nodes: readonly NavigationNode[],
  parentId: string | null = null,
): HeaderMenuItem[] {
  return childNavigationNodes(nodes, parentId).map((node) => {
    const children = createHeaderMenuItems(nodes, node.id)
    const common = {
      value: node.code,
      label: node.name,
      icon: resolveNavigationIcon(node.icon, node.type),
    }

    if (children.length > 0) return { ...common, children }
    if (node.type === 'MENU') return { ...common, to: navigationTarget(node) ?? '/__recovery' }
    if (node.type === 'EXTERNAL_LINK') {
      return {
        ...common,
        href: node.href ?? '#',
        external: true,
        target: node.externalTarget === 'BLANK' ? '_blank' : '_self',
      }
    }
    return { ...common, disabled: true }
  })
}
