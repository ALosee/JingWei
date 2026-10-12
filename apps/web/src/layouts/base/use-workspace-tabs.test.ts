// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useWorkspaceTabs } from './use-workspace-tabs'

enableAutoUnmount(afterEach)

describe('workspace tab locations', () => {
  it('reuses path identity, restores the last query/hash and prevents closing the final tab', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/account/:id', component: { render: () => null }, meta: { title: '个人账号' } },
        { path: '/roles', component: { render: () => null }, meta: { title: '角色权限' } },
      ],
    })
    await router.push('/account/me?tab=profile#details')
    let tabs: ReturnType<typeof useWorkspaceTabs> | undefined
    mount(
      {
        setup() {
          tabs = useWorkspaceTabs()
          return () => null
        },
      },
      { global: { plugins: [router] } },
    )
    if (!tabs) throw new Error('Tab controller was not mounted')
    const collection = tabs.items.value
    expect(tabs.beforeClose()).toBe(false)
    await router.push('/account/me?tab=security#password')
    expect(tabs.items.value).toBe(collection)
    expect(tabs.items.value).toHaveLength(1)
    await router.push('/roles')
    expect(tabs.beforeClose()).toBe(true)
    tabs.activeValue.value = '/account/me'
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/account/me?tab=security#password')
    expect(tabs.items.value).toHaveLength(2)
  })
})
