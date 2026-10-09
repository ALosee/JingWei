// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { TreeNav } from '@jingwei/ui'

import { useShellStore } from '../../../../stores/shell.js'
import { layoutTargetIds } from '../../layout-targets.js'
import HeaderGlobalMenu from './HeaderGlobalMenu.vue'

enableAutoUnmount(afterEach)
beforeEach(() => {
  document.body.replaceChildren()
  const target = document.createElement('div')
  target.id = layoutTargetIds.headerMenu
  document.body.appendChild(target)
})

describe('HeaderGlobalMenu route selection', () => {
  it('passes the visible route code using the current TreeNav selection contract', async () => {
    const pinia = createPinia()
    const shell = useShellStore(pinia)
    shell.navigation = {
      schemaVersion: 2,
      versionId: 'version',
      publishedRevision: 1,
      authEntryCode: 'login',
      homeCode: 'account',
      nodes: [
        {
          id: 'account',
          code: 'account',
          name: '个人账号',
          type: 'MENU',
          status: 'ENABLED',
          parentId: null,
          routeKey: 'iam.account',
          path: '/account',
          layout: 'base',
          icon: null,
          sortOrder: 0,
          accessMode: 'AUTHENTICATED',
          href: null,
          externalTarget: null,
          params: {},
          query: {},
        },
      ],
    }
    const account = shell.navigation.nodes[0]
    if (account === undefined) throw new Error('Account menu fixture is missing')
    shell.navigation.nodes.push({
      ...account,
      id: 'security',
      code: 'security',
      name: '安全设置',
      type: 'PAGE',
      parentId: account.id,
      path: '/account/security',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/account',
          component: { render: () => null },
          meta: { navigationCode: 'account' },
        },
        {
          path: '/account/security',
          component: { render: () => null },
          meta: { navigationCode: 'security' },
        },
      ],
    })
    await router.push('/account')
    const wrapper = mount(HeaderGlobalMenu, {
      global: { plugins: [pinia, router], stubs: { STreeNav: true } },
    })
    await flushPromises()
    const menu = wrapper.getComponent(TreeNav)
    expect(menu.props('modelValue')).toBe('account')
    expect(menu.attributes('selected-value')).toBeUndefined()
    await router.push('/account/security')
    await flushPromises()
    expect(menu.props('modelValue')).toBe('account')
  })
})
