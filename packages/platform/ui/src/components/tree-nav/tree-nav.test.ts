// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TreeNav from './tree-nav.vue'

vi.mock('@iconify/vue', () => ({ Icon: { name: 'Iconify', render: () => null } }))
enableAutoUnmount(afterEach)
const global = { provide: { [Symbol.for('ConfigProvider')]: { dir: 'ltr', locale: 'zh-CN' } } }

describe('TreeNav', () => {
  it('renders labels and keeps route-controlled selection until the owner updates it', async () => {
    const wrapper = mount(TreeNav, {
      global,
      props: {
        modelValue: 'account',
        items: [
          { value: 'account', label: '个人账号', href: '/account', target: '_self' },
          { value: 'branding', label: '品牌定制', href: '/branding', target: '_self' },
        ],
      },
    })
    const links = wrapper.findAll('a')
    expect(links[0]?.text()).toContain('个人账号')
    expect(links[0]?.attributes('data-selected')).toBe('true')
    await links[1]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['branding']])
    expect(links[0]?.attributes('data-selected')).toBe('true')
    await wrapper.setProps({ modelValue: 'branding' })
    expect(links[1]?.attributes('data-selected')).toBe('true')
  })

  it('derives the parent highlight from a nested selected leaf', async () => {
    const wrapper = mount(TreeNav, {
      global,
      props: {
        modelValue: 'branding',
        items: [
          {
            value: 'system',
            label: '系统管理',
            children: [
              { value: 'account', label: '个人账号', href: '/account' },
              { value: 'branding', label: '品牌定制', href: '/branding' },
            ],
          },
        ],
      },
    })
    const trigger = wrapper.get('button')
    expect(trigger.text()).toContain('系统管理')
    expect(trigger.attributes('data-child-selected')).toBe('')
    expect(trigger.attributes('data-selected')).toBe('false')
    await wrapper.setProps({ modelValue: 'unrelated' })
    expect(trigger.attributes('data-child-selected')).toBeUndefined()
  })

  it('renders popup groups as non-interactive titles instead of another submenu', async () => {
    const wrapper = mount(TreeNav, {
      global,
      attachTo: document.body,
      props: {
        modelValue: 'account',
        items: [
          {
            value: 'system',
            label: '系统管理',
            children: [
              {
                value: 'group',
                label: '账户入口',
                isGroup: true,
                children: [{ value: 'account', label: '个人账号', href: '/account' }],
              },
            ],
          },
        ],
      },
    })
    await wrapper.get('button').trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    const label = document.querySelector('[data-vean-menu-group-label]')
    expect(label?.textContent).toBe('账户入口')
    expect(label?.getAttribute('role')).not.toBe('menuitem')
    expect(
      Array.from(document.querySelectorAll('[role="menuitem"]')).some((item) =>
        item.textContent.includes('个人账号'),
      ),
    ).toBe(true)
  })

  it('blocks disabled navigation and keeps safe external link attributes', async () => {
    const wrapper = mount(TreeNav, {
      global,
      props: {
        items: [
          { value: 'disabled', label: '不可访问', disabled: true, href: '/disabled' },
          {
            value: 'help',
            label: '帮助中心',
            href: 'https://example.com/help',
            external: true,
            target: '_blank',
          },
        ],
      },
    })
    await wrapper.findAll('a')[0]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const external = wrapper.findAll('a')[1]
    expect(external?.attributes('href')).toBe('https://example.com/help')
    expect(external?.attributes('target')).toBe('_blank')
    expect(external?.attributes('rel')).toContain('noopener')
  })

  it('opens a branch with the keyboard and preserves selection after Escape', async () => {
    const wrapper = mount(TreeNav, {
      global,
      attachTo: document.body,
      props: {
        modelValue: 'account',
        items: [
          {
            value: 'system',
            label: '系统管理',
            children: [{ value: 'account', label: '个人账号', href: '/account' }],
          },
        ],
      },
    })
    const trigger = wrapper.get('button')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const popup = document.querySelector('[role="menu"]')
    if (popup === null) throw new Error('TreeNav keyboard popup was not mounted')
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('data-child-selected')).toBe('')
  })
})
