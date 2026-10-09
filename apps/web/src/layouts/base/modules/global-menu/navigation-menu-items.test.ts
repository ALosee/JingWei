import { describe, expect, it } from 'vitest'

import type { NavigationNode } from '@jingwei/module-navigation/shared'

import { createHeaderMenuItems } from './navigation-menu-items'

const node = (overrides: Partial<NavigationNode>): NavigationNode => ({
  id: 'group',
  code: 'group',
  name: '工作区',
  type: 'GROUP',
  status: 'ENABLED',
  parentId: null,
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

describe('header TreeNav data', () => {
  it('preserves group and directory structure, excludes PAGE and resolves navigation targets', () => {
    const nodes = [
      node({}),
      node({
        id: 'directory',
        code: 'directory',
        name: '系统管理',
        type: 'DIRECTORY',
        parentId: 'group',
      }),
      node({
        id: 'account',
        code: 'account',
        name: '个人账号',
        type: 'MENU',
        parentId: 'directory',
        routeKey: 'iam.account',
        path: '/account/:id',
        layout: 'base',
        accessMode: 'AUTHENTICATED',
        params: { id: 'me' },
        query: { section: 'profile' },
      }),
      node({
        id: 'page',
        code: 'detail',
        name: '账号详情',
        type: 'PAGE',
        parentId: 'account',
        routeKey: 'iam.account',
        path: '/account/detail',
        layout: 'base',
        accessMode: 'AUTHENTICATED',
      }),
      node({
        id: 'help',
        code: 'help',
        name: '帮助中心',
        type: 'EXTERNAL_LINK',
        parentId: 'group',
        href: 'https://example.com/help',
        externalTarget: 'BLANK',
        accessMode: 'AUTHENTICATED',
        sortOrder: 2,
      }),
    ]
    const items = createHeaderMenuItems(nodes)
    expect(items[0]?.isGroup).toBe(true)
    const children = items[0]?.children
    expect(children?.map((item) => item.value)).toEqual(['directory', 'help'])
    expect(children?.[0]?.isGroup).toBe(false)
    expect(children?.[0]?.children).toEqual([
      expect.objectContaining({ value: 'account', to: '/account/me?section=profile' }),
    ])
    expect(children?.[1]).toMatchObject({
      href: 'https://example.com/help',
      target: '_blank',
      external: true,
    })
  })

  it('does not expose an empty container as a selectable destination', () => {
    expect(createHeaderMenuItems([node({ type: 'DIRECTORY' })])[0]).toMatchObject({
      value: 'group',
      disabled: true,
    })
  })
})
