import { describe, expect, it } from 'vitest'

import type { NavigationNode } from '@jingwei/module-navigation/shared'

import { createAppShellItems } from './app-shell-items'

function node(overrides: Partial<NavigationNode>): NavigationNode {
  return {
    id: 'root',
    code: 'root',
    name: '系统管理',
    type: 'DIRECTORY',
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
  }
}

describe('AppShell navigation input', () => {
  it('preserves hidden PAGE ancestry without changing menu destinations', () => {
    const items = createAppShellItems([
      node({}),
      node({
        id: 'account',
        code: 'account',
        name: '个人账号',
        parentId: 'root',
        type: 'MENU',
        path: '/account/:id',
        params: { id: 'me' },
        query: { tab: 'profile' },
      }),
      node({
        id: 'detail',
        code: 'detail',
        name: '账号详情',
        parentId: 'account',
        type: 'PAGE',
        path: '/details/:id',
      }),
      node({ id: 'nested', code: 'nested', name: '安全设置', parentId: 'detail', type: 'PAGE' }),
    ])
    const account = items[0]?.children?.[0]
    expect(account).toMatchObject({
      value: 'account',
      to: '/account/me?tab=profile',
      hidden: false,
    })
    expect(account?.children?.[0]).toMatchObject({
      value: 'detail',
      hidden: true,
      children: [{ value: 'nested', label: '安全设置', hidden: true }],
    })
  })

  it('retains independently authorized PAGE nodes when their parent is absent', () => {
    expect(
      createAppShellItems([node({ type: 'PAGE', parentId: 'ungranted', name: '独立详情' })]),
    ).toMatchObject([{ value: 'root', label: '独立详情', hidden: true }])
  })

  it('preserves group, stable ordering and safe external-link data', () => {
    const items = createAppShellItems([
      node({ type: 'GROUP' }),
      node({
        id: 'b',
        code: 'b',
        type: 'EXTERNAL_LINK',
        parentId: 'root',
        href: 'https://example.com/help',
        externalTarget: 'BLANK',
      }),
      node({ id: 'a', code: 'a', type: 'MENU', parentId: 'root', path: '/account' }),
    ])
    expect(items[0]?.isGroup).toBe(true)
    expect(items[0]?.children?.map((item) => item.value)).toEqual(['a', 'b'])
    expect(items[0]?.children?.[1]).toMatchObject({
      href: 'https://example.com/help',
      target: '_blank',
      external: true,
    })
  })
})
