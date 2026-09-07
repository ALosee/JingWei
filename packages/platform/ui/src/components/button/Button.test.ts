// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Button from './Button.vue'

describe('Button', () => {
  it('uses a safe native button type and emits clicks', async () => {
    const wrapper = mount(Button, { slots: { default: '保存' } })

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.attributes('type')).toBe('button')

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('blocks interaction while disabled', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('exposes loading as an accessible disabled state', async () => {
    const wrapper = mount(Button, { props: { loading: true } })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('forwards native accessibility attributes', () => {
    const wrapper = mount(Button, {
      attrs: { 'aria-label': '保存导航', 'data-test': 'save-navigation' },
    })

    expect(wrapper.attributes('aria-label')).toBe('保存导航')
    expect(wrapper.attributes('data-test')).toBe('save-navigation')
  })
})
