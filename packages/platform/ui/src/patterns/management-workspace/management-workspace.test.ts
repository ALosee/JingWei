// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ManagementListToolbar from './management-list-toolbar.vue'
import ManagementWorkspace from './management-workspace.vue'

describe('ManagementListToolbar', () => {
  it('uses one action to clear or close search while Escape preserves the keyword', async () => {
    const wrapper = mount(ManagementListToolbar, {
      attachTo: document.body,
      props: {
        title: '角色列表',
        summary: '1 个角色',
        modelValue: '',
        searchLabel: '搜索角色',
        searchPlaceholder: '搜索角色名称或编码',
        createLabel: '新建角色',
        canCreate: true,
      },
    })

    try {
      await wrapper.get('button[aria-label="新建角色"]').trigger('click')
      expect(wrapper.emitted('create')).toHaveLength(1)

      await wrapper.get('button[aria-label="搜索角色"]').trigger('click')
      const input = wrapper.get('input[aria-label="搜索角色"]')
      expect(document.activeElement).toBe(input.element)
      expect(wrapper.get('[data-vean-input-root]').findAll('button')).toHaveLength(1)
      expect(wrapper.find('button[aria-label="关闭搜索"]').exists()).toBe(true)
      await input.setValue('管理员')
      expect(wrapper.emitted('update:modelValue')).toEqual([['管理员']])
      await wrapper.setProps({ modelValue: '管理员' })
      expect(wrapper.get('[data-vean-input-root]').findAll('button')).toHaveLength(1)
      expect(wrapper.find('button[aria-label="关闭搜索"]').exists()).toBe(false)

      await input.trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('update:modelValue')).toEqual([['管理员']])
      expect(wrapper.get('button[aria-label="搜索角色"]').element).toBe(document.activeElement)

      await wrapper.get('button[aria-label="搜索角色"]').trigger('click')
      expect(wrapper.get<HTMLInputElement>('input[aria-label="搜索角色"]').element.value).toBe(
        '管理员',
      )
      await wrapper.get('button[aria-label="清空搜索"]').trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([['管理员'], ['']])
      expect(wrapper.find('input[aria-label="搜索角色"]').exists()).toBe(true)
      expect(document.activeElement).toBe(wrapper.get('input[aria-label="搜索角色"]').element)

      await wrapper.setProps({ modelValue: '' })
      expect(wrapper.get('[data-vean-input-root]').findAll('button')).toHaveLength(1)
      await wrapper.get('button[aria-label="关闭搜索"]').trigger('click')
      expect(wrapper.find('input[aria-label="搜索角色"]').exists()).toBe(false)
      expect(wrapper.get('button[aria-label="搜索角色"]').element).toBe(document.activeElement)
      expect(wrapper.emitted('update:modelValue')).toEqual([['管理员'], ['']])
    } finally {
      wrapper.unmount()
    }
  })
})

describe('ManagementWorkspace', () => {
  it('keeps list and detail slots separate and exposes mobile back navigation', async () => {
    const wrapper = mount(ManagementWorkspace, {
      props: {
        title: '角色管理',
        mobileDetailOpen: true,
      },
      slots: { list: '<div>角色列表</div>', detail: '<div>角色详情</div>' },
    })

    expect(wrapper.get('h1').text()).toBe('角色管理')
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.get('aside').text()).toBe('角色列表')
    expect(wrapper.get('[role="separator"]').attributes('aria-label')).toBe('调整列表与详情宽度')
    expect(wrapper.get('section[aria-label="详情工作区"]').text()).toContain('角色详情')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
