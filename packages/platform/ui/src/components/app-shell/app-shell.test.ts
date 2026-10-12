// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import AppShell from './app-shell.vue'
import type { AppShellMode } from './types'

vi.mock('@iconify/vue', () => ({ Icon: { name: 'Iconify', render: () => null } }))
enableAutoUnmount(afterEach)

const items = [
  {
    value: 'system',
    label: '系统管理',
    children: [
      {
        value: 'account',
        label: '个人账号',
        href: '/account',
        children: [{ value: 'detail', label: '账号详情', hidden: true }],
      },
      {
        value: 'help',
        label: '帮助中心',
        href: 'https://example.com/help',
        external: true,
        target: '_blank' as const,
      },
    ],
  },
]

async function renderShell(
  mode: AppShellMode = 'sidebar',
  value = 'detail',
  mobile = false,
  brand = false,
) {
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    props: {
      items,
      mode,
      modelValue: value,
      isMobile: mobile,
      logoPlacement: brand ? 'sidebar' : 'auto',
      layoutProps: { footerVisible: false, tabVisible: false },
    },
    global: {
      stubs: { SIcon: true },
      components: { RouterLink: { render: () => null } },
      provide: { [Symbol.for('ConfigProvider')]: { dir: 'ltr', locale: 'zh-CN' } },
    },
    slots: brand ? { logo: () => h('span', '品牌标志'), title: () => h('span', '品牌标题') } : {},
  })
  await flushPromises()
  return wrapper
}

describe('native AppShell composition', () => {
  it('forwards native split brand slots and hides the title when its pane collapses', async () => {
    const wrapper = await renderShell('dual-vertical', 'account', false, true)
    expect(wrapper.get('[data-vean-app-shell-logo-title]').text()).toBe('品牌标题')
    await wrapper.setProps({ open: false })
    expect(wrapper.find('[data-vean-app-shell-logo-title]').exists()).toBe(false)
    expect(wrapper.get('[data-vean-app-shell-logo-mark]').text()).toBe('品牌标志')
  })
  it('shows a hidden page in the breadcrumb and excludes it from navigation and dropdowns', async () => {
    const wrapper = await renderShell()
    expect(wrapper.get('[data-vean-app-shell-header]').text()).toContain('账号详情')
    expect(wrapper.get('[data-vean-app-shell-menu-sidebar]').text()).not.toContain('账号详情')
    const trigger = wrapper
      .findAll('[data-vean-app-shell-header] button')
      .find((button) => button.text().includes('系统管理'))
    if (!trigger) throw new Error('Native ancestor dropdown trigger is missing')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    const links = Array.from(document.querySelectorAll('[role="menuitem"]'))
    expect(links.some((link) => link.textContent.includes('账号详情'))).toBe(false)
    expect(
      document
        .querySelector('[role="menuitem"][href="https://example.com/help"]')
        ?.getAttribute('rel'),
    ).toContain('noopener')
  })

  it.each<AppShellMode>([
    'sidebar',
    'top',
    'dual-vertical',
    'vertical-horizontal',
    'horizontal-vertical',
    'horizontal-dual-vertical',
  ])('assembles %s and preserves the controlled route value', async (mode) => {
    const wrapper = await renderShell(mode, 'account')
    expect(wrapper.attributes('data-mode')).toBe(mode)
    expect(wrapper.find('[data-vean-app-shell-content]').exists()).toBe(true)
    expect(wrapper.props('modelValue')).toBe('account')
  })

  it('uses an expanded full-menu drawer on mobile independently of desktop collapse', async () => {
    const wrapper = await renderShell('top', 'account', true)
    await wrapper.setProps({ open: false, mobileOpen: true })
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[data-vean-tree-menu-root]')?.getAttribute('data-state')).toBe(
      'expanded',
    )
    expect(wrapper.props('open')).toBe(false)
  })
})
