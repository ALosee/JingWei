import { describe, expect, it } from 'vitest'

import type { NavigationNode } from '@jingwei/module-navigation/shared'

import {
  activeNavigationMenuCode,
  childNavigationNodes,
  containsActiveNavigation,
  navigationBreadcrumbs,
  searchableNavigationItems,
} from './presentation.js'

const node = (overrides: Partial<NavigationNode>): NavigationNode => ({
  id: 'root',
  code: 'root',
  name: '工作区',
  parentId: null,
  type: 'GROUP',
  status: 'ENABLED',
  routeKey: null,
  path: null,
  layout: null,
  icon: null,
  sortOrder: 0,
  accessMode: null,
  href: null,
  externalTarget: null,
  params: {},
  query: {},
  ...overrides,
})

const root = node({})
const directory = node({
  id: 'directory',
  code: 'system',
  name: '系统管理',
  type: 'DIRECTORY',
  parentId: root.id,
})
const menu = node({
  id: 'menu',
  code: 'navigation.manage',
  name: '导航管理',
  type: 'MENU',
  parentId: directory.id,
  routeKey: 'navigation.manage',
  path: '/navigation/manage',
  layout: 'base',
  accessMode: 'PERMISSION',
})
const page = node({
  id: 'page',
  code: 'navigation.detail',
  name: '导航详情',
  type: 'PAGE',
  parentId: menu.id,
  routeKey: 'navigation.detail',
  path: '/navigation/:id',
  layout: 'base',
  accessMode: 'PERMISSION',
})
const external = node({
  id: 'external',
  code: 'docs',
  name: '帮助中心',
  type: 'EXTERNAL_LINK',
  parentId: root.id,
  href: 'https://example.com/help',
  accessMode: 'AUTHENTICATED',
  sortOrder: 10,
})
const nodes = [menu, page, root, external, directory]

describe('navigation presentation', () => {
  it('sorts visible children and excludes PAGE nodes from menus', () => {
    expect(childNavigationNodes(nodes, root.id).map((item) => item.code)).toEqual([
      'system',
      'docs',
    ])
  })

  it('builds breadcrumbs through containers and visible parents', () => {
    expect(navigationBreadcrumbs(nodes, page.code).map((item) => item.name)).toEqual([
      '工作区',
      '系统管理',
      '导航管理',
      '导航详情',
    ])
  })

  it('maps a hidden PAGE route back to its nearest visible menu', () => {
    expect(activeNavigationMenuCode(nodes, page.code)).toBe(menu.code)
    expect(activeNavigationMenuCode(nodes, 'missing')).toBe('')
  })

  it('searches only visible destinations with contextual labels', () => {
    expect(searchableNavigationItems(nodes).map((item) => [item.label, item.target])).toEqual([
      ['工作区 / 系统管理 / 导航管理', '/navigation/manage'],
      ['工作区 / 帮助中心', 'https://example.com/help'],
    ])
  })

  it('marks a container active when it contains the current menu', () => {
    expect(containsActiveNavigation(nodes, root, menu.code)).toBe(true)
    expect(containsActiveNavigation(nodes, external, menu.code)).toBe(false)
  })
})
