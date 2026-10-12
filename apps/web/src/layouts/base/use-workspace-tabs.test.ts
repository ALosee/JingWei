// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'

import { useShellStore } from '../../stores/shell.js'
import { useWorkspaceTabs } from './use-workspace-tabs'
import { workspaceTabSessionKey } from './workspace-tab-session'

enableAutoUnmount(afterEach)
beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

const home: NavigationNode = {
  id: '00000000-0000-7000-8000-000000000001',
  code: 'iam.account',
  name: '个人账号',
  type: 'MENU',
  status: 'ENABLED',
  parentId: null,
  routeKey: 'iam.account',
  path: '/account/:id',
  layout: 'base',
  icon: null,
  sortOrder: 0,
  accessMode: 'AUTHENTICATED',
  href: null,
  externalTarget: null,
  params: { id: 'me' },
  query: { tab: 'profile' },
}
const roles: NavigationNode = {
  ...home,
  id: '00000000-0000-7000-8000-000000000002',
  code: 'iam.roles',
  name: '角色权限',
  routeKey: 'iam.roles',
  path: '/roles',
  params: {},
  query: {},
}
const navigation: NavigationResponse = {
  schemaVersion: 2,
  versionId: '00000000-0000-7000-8000-000000000100',
  publishedRevision: 1,
  homeCode: home.code,
  authEntryCode: 'iam.login',
  nodes: [home, roles],
}

const currentUser = {
  id: '00000000-0000-7000-8000-000000000200',
  tenantId: '00000000-0000-7000-8000-000000000201',
  displayName: '管理员',
  avatarUrl: null,
}
const sessionKey = workspaceTabSessionKey(currentUser.tenantId, currentUser.id)

async function renderTabs(path: string, nav = navigation, user = currentUser) {
  const pinia = createPinia()
  const shell = useShellStore(pinia)
  shell.navigation = nav
  shell.currentUser = user
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/account/:id',
        component: { render: () => null },
        meta: { title: home.name, navigationCode: home.code, routeKey: home.routeKey },
      },
      {
        path: '/roles',
        component: { render: () => null },
        meta: { title: roles.name, navigationCode: roles.code, routeKey: roles.routeKey },
      },
    ],
  })
  await router.push(path)
  let tabs: ReturnType<typeof useWorkspaceTabs> | undefined
  const wrapper = mount(
    {
      setup() {
        tabs = useWorkspaceTabs()
        return () => null
      },
    },
    { global: { plugins: [pinia, router] } },
  )
  if (!tabs) throw new Error('Tab controller was not mounted')
  return { tabs, router, shell, wrapper }
}

describe('workspace tab locations', () => {
  it('starts with the configured concrete home, locked at the left even on a deep link', async () => {
    const { tabs, router } = await renderTabs('/roles')
    expect(tabs.items.value.map((item) => item.value)).toEqual(['/account/me', '/roles'])
    expect(tabs.items.value[0]).toMatchObject({ pinned: true, draggable: false })
    expect(tabs.beforeClose('/account/me')).toBe(false)
    expect(tabs.beforeClose('/roles')).toBe(true)
    tabs.activeValue.value = '/account/me'
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/account/me?tab=profile')
  })

  it('reuses path identity and keeps pinning and the last query/hash on revisits', async () => {
    const { tabs, router } = await renderTabs('/roles')
    const collection = tabs.items.value
    const roleTab = tabs.items.value.find((item) => item.value === '/roles')
    if (!roleTab) throw new Error('Role tab is missing')
    roleTab.pinned = true
    await router.push('/account/me?tab=security#password')
    tabs.activeValue.value = '/roles'
    await flushPromises()
    expect(tabs.items.value).toBe(collection)
    expect(tabs.items.value).toHaveLength(2)
    expect(tabs.items.value.find((item) => item.value === '/roles')?.pinned).toBe(true)
    tabs.activeValue.value = '/account/me'
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/account/me?tab=security#password')
  })

  it('updates the permanent home when the navigation version changes', async () => {
    const { tabs, shell, router } = await renderTabs('/account/me')
    shell.navigation = { ...navigation, homeCode: roles.code, publishedRevision: 2 }
    await flushPromises()
    expect(tabs.items.value.map((item) => item.value)).toEqual(['/roles', '/account/me'])
    expect(tabs.items.value[0]).toMatchObject({ pinned: true, draggable: false })
    expect(tabs.items.value[1]).toMatchObject({ pinned: false, draggable: true })
    expect(router.currentRoute.value.path).toBe('/account/me')
  })

  it('forgets bulk-closed locations before making one the new configured home', async () => {
    const { tabs, router, shell } = await renderTabs('/roles?filter=old')
    tabs.items.value = tabs.items.value.filter((item) => item.value !== '/roles')
    tabs.activeValue.value = '/account/me'
    await flushPromises()
    shell.navigation = { ...navigation, homeCode: roles.code, publishedRevision: 2 }
    await flushPromises()
    tabs.activeValue.value = '/roles'
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/roles')
  })

  it('restores the tab order, pins and last locations while the browser URL determines the active tab', async () => {
    const first = await renderTabs('/roles')
    await first.router.push('/account/a?section=last#details')
    await first.router.push('/account/b')
    const [homeTab, roleTab, a, b] = first.tabs.items.value
    if (!homeTab || !roleTab || !a || !b) throw new Error('Visited tabs are missing')
    roleTab.pinned = true
    first.tabs.items.value = [homeTab, roleTab, b, a]
    await flushPromises()
    first.wrapper.unmount()

    const restored = await renderTabs('/account/b?section=current')
    expect(restored.tabs.items.value.map((item) => item.value)).toEqual([
      '/account/me',
      '/roles',
      '/account/b',
      '/account/a',
    ])
    expect(restored.tabs.items.value[1]?.pinned).toBe(true)
    expect(restored.tabs.activeValue.value).toBe('/account/b')
    expect(restored.router.currentRoute.value.fullPath).toBe('/account/b?section=current')
    restored.tabs.activeValue.value = '/account/a'
    await flushPromises()
    expect(restored.router.currentRoute.value.fullPath).toBe('/account/a?section=last#details')
  })

  it('removes revoked tabs on a new navigation version and regenerates the permanent home', async () => {
    const first = await renderTabs('/roles')
    await first.router.push('/account/a')
    await flushPromises()
    first.wrapper.unmount()
    const nextNavigation = { ...navigation, nodes: [home], publishedRevision: 2 }
    const restored = await renderTabs('/account/me', nextNavigation)
    expect(restored.tabs.items.value.map((item) => item.value)).toEqual([
      '/account/me',
      '/account/a',
    ])
    expect(restored.tabs.items.value[0]).toMatchObject({ pinned: true, draggable: false })
  })

  it('does not mix sessions between users or tenants, including scope changes in the mounted shell', async () => {
    const first = await renderTabs('/roles')
    await first.router.push('/account/a')
    await first.router.push('/account/me')
    await flushPromises()
    first.shell.currentUser = { ...currentUser, id: 'another-user' }
    await flushPromises()
    expect(first.tabs.items.value.map((item) => item.value)).toEqual(['/account/me'])
    first.shell.currentUser = currentUser
    await flushPromises()
    expect(first.tabs.items.value.map((item) => item.value)).toEqual([
      '/account/me',
      '/roles',
      '/account/a',
    ])
    first.wrapper.unmount()
    const otherTenant = await renderTabs('/account/me', navigation, {
      ...currentUser,
      tenantId: 'another-tenant',
    })
    expect(otherTenant.tabs.items.value.map((item) => item.value)).toEqual(['/account/me'])
  })

  it('preserves a user pin when the tab temporarily becomes the navigation home', async () => {
    const first = await renderTabs('/roles')
    const role = first.tabs.items.value.find((item) => item.value === '/roles')
    if (!role) throw new Error('Role tab is missing')
    role.pinned = true
    first.shell.navigation = { ...navigation, homeCode: roles.code, publishedRevision: 2 }
    await flushPromises()
    first.wrapper.unmount()
    const restored = await renderTabs('/account/me', { ...navigation, publishedRevision: 3 })
    expect(restored.tabs.items.value.find((item) => item.value === '/roles')?.pinned).toBe(true)
    restored.shell.currentUser = null
    restored.shell.navigation = null
    await flushPromises()
    expect(restored.tabs.items.value).toEqual([])
    expect(restored.tabs.activeValue.value).toBe('')
  })

  it('tolerates malformed snapshots and unavailable browser storage', async () => {
    sessionStorage.setItem(sessionKey, '{invalid')
    const first = await renderTabs('/roles')
    expect(first.tabs.items.value).toHaveLength(2)
    first.wrapper.unmount()
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('Storage is unavailable')
    })
    const noStorage = await renderTabs('/roles')
    await noStorage.router.push('/account/a')
    expect(noStorage.tabs.items.value).toHaveLength(3)
  })

  it('rejects unsafe URLs, changed route identities and malformed entries, and deduplicates paths', async () => {
    const saved = {
      navigationCode: home.code,
      routeKey: home.routeKey,
      fullPath: '/account/a?section=cache#details',
      pinned: true,
    }
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({
        version: 1,
        tabs: [
          saved,
          { ...saved, fullPath: '/account/a?section=duplicate' },
          { ...saved, fullPath: '/account/b', navigationCode: roles.code },
          { ...saved, fullPath: '/account/c', routeKey: 'another-page' },
          { ...saved, fullPath: 'https://example.com' },
          { ...saved, fullPath: '//example.com' },
          { ...saved, fullPath: '/__recovery' },
          { ...saved, fullPath: '/account/d', pinned: 'true' },
          null,
        ],
      }),
    )
    const restored = await renderTabs('/account/me')
    expect(restored.tabs.items.value.map((item) => item.value)).toEqual([
      '/account/me',
      '/account/a',
    ])
    expect(restored.tabs.items.value[1]).toMatchObject({ pinned: true, label: home.name })
    restored.tabs.activeValue.value = '/account/a'
    await flushPromises()
    expect(restored.router.currentRoute.value.fullPath).toBe('/account/a?section=cache#details')
  })
})
