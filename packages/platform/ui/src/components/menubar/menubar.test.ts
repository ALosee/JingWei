// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Menubar from './menubar.vue'

vi.mock('@iconify/vue', () => ({ Icon: { name: 'Iconify', render: () => null } }))
enableAutoUnmount(afterEach)

describe('Menubar content forwarding', () => {
  it('keeps default link and branch labels when no trigger slot is provided', () => {
    const wrapper = mount(Menubar, {
      props: {
        items: [
          { value: 'account', label: '个人账号', href: '/account' },
          {
            value: 'settings',
            label: '系统设置',
            children: [{ value: 'branding', label: '品牌定制', href: '/branding' }],
          },
        ],
      },
    })
    expect(wrapper.get('a').text()).toContain('个人账号')
    expect(wrapper.get('button').text()).toContain('系统设置')
  })

  it('keeps explicitly provided trigger content', () => {
    const wrapper = mount(Menubar, {
      props: { items: [{ value: 'account', label: '个人账号', href: '/account' }] },
      slots: { trigger: '<span>自定义入口</span>' },
    })
    expect(wrapper.get('a').text()).toBe('自定义入口')
  })
})
