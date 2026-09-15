import { describe, expect, it } from 'vitest'

import type { NavigationNode } from '../../shared/index.js'
import { projectSidebarPreview } from './navigation-preview.js'
import {
  buildNavigationTree,
  canNestNode,
  flattenNavigationTree,
  nextSortOrder,
  parentOptionsFor,
  uniqueCode,
} from './navigation-tree.js'

function node(partial: Partial<NavigationNode> & { id: string; code: string }): NavigationNode {
  return {
    name: partial.code,
    parentId: null,
    type: 'MENU',
    status: 'ENABLED',
    routeKey: 'demo.page',
    path: '/demo',
    layout: 'base',
    icon: null,
    sortOrder: 0,
    accessMode: 'AUTHENTICATED',
    href: null,
    externalTarget: null,
    params: {},
    query: {},
    ...partial,
  }
}

describe('navigation tree', () => {
  const nodes: NavigationNode[] = [
    node({ id: 'dir', code: 'dir', type: 'DIRECTORY', name: '系统', sortOrder: 0 }),
    node({ id: 'menu-a', code: 'menu.a', parentId: 'dir', name: 'A', sortOrder: 1 }),
    node({ id: 'menu-b', code: 'menu.b', parentId: 'dir', name: 'B', sortOrder: 0 }),
    node({
      id: 'page',
      code: 'page',
      parentId: 'menu-a',
      type: 'PAGE',
      name: '详情',
      sortOrder: 0,
    }),
    node({ id: 'link', code: 'link', type: 'EXTERNAL_LINK', name: '外链', sortOrder: 10 }),
  ]

  it('builds sorted hierarchy and flattens with search', () => {
    const tree = buildNavigationTree(nodes)
    expect(tree.map((item) => item.node.id)).toEqual(['dir', 'link'])
    const rows = flattenNavigationTree(tree, new Set(['dir', 'menu-a']), '')
    expect(rows.map((row) => row.node.id)).toEqual(['dir', 'menu-b', 'menu-a', 'page', 'link'])
    const filtered = flattenNavigationTree(tree, new Set(), '详情')
    expect(filtered.map((row) => row.node.id)).toContain('page')
    expect(filtered.map((row) => row.node.id)).toContain('menu-a')
  })

  it('prevents invalid nesting and generates unique codes', () => {
    expect(canNestNode(nodes, 'dir', 'menu-a')).toBe(false)
    expect(canNestNode(nodes, 'menu-a', 'link')).toBe(false)
    expect(canNestNode(nodes, 'page', 'menu-b')).toBe(true)
    expect(uniqueCode(nodes, 'menu.a')).toBe('menu.a-2')
    expect(nextSortOrder(nodes, 'dir')).toBe(2)
    const menuA = nodes.find((item) => item.id === 'menu-a')
    expect(menuA).toBeDefined()
    if (menuA !== undefined) {
      expect(parentOptionsFor(nodes, menuA).map((item) => item.id)).toEqual([null, 'dir'])
    }
  })
})

describe('sidebar preview', () => {
  it('mirrors server projection for public and permission views', () => {
    const nodes: NavigationNode[] = [
      node({ id: 'dir', code: 'dir', type: 'DIRECTORY', name: '系统' }),
      node({ id: 'pub', code: 'pub', type: 'PAGE', accessMode: 'PUBLIC', path: '/login' }),
      node({ id: 'auth', code: 'auth', parentId: 'dir', accessMode: 'AUTHENTICATED' }),
      node({
        id: 'perm',
        code: 'perm',
        parentId: 'dir',
        accessMode: 'PERMISSION',
      }),
      node({
        id: 'off',
        code: 'off',
        parentId: 'dir',
        status: 'DISABLED',
        accessMode: 'PUBLIC',
      }),
    ]
    const publicView = projectSidebarPreview(nodes, 'public').map((item) => item.id)
    expect(publicView).toContain('pub')
    expect(publicView).not.toContain('auth')
    expect(publicView).not.toContain('perm')
    expect(publicView).not.toContain('off')

    const authView = projectSidebarPreview(nodes, 'authenticated').map((item) => item.id)
    expect(authView).toContain('auth')
    expect(authView).not.toContain('perm')
    // AUTHENTICATED menu keeps its directory container
    expect(authView).toContain('dir')

    const roleView = projectSidebarPreview(nodes, 'role', new Set(['perm'])).map((item) => item.id)
    expect(roleView).toContain('perm')
    expect(roleView).toContain('dir')
    expect(roleView).toContain('auth')
  })
})
