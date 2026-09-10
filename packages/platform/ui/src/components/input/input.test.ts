// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Input from './input.vue'

describe('Input', () => {
  it('renders a native input and forwards model updates', async () => {
    const wrapper = mount(Input, {
      props: { modelValue: '', placeholder: '请输入名称' },
    })
    const input = wrapper.get('input')

    expect(input.attributes('placeholder')).toBe('请输入名称')

    await input.setValue('经纬')

    expect(wrapper.emitted('update:modelValue')).toEqual([['经纬']])
  })

  it('forwards accessible attributes', () => {
    const wrapper = mount(Input, {
      attrs: { 'aria-label': '组织名称' },
      props: { modelValue: '' },
    })

    expect(wrapper.get('input').attributes('aria-label')).toBe('组织名称')
  })
})
