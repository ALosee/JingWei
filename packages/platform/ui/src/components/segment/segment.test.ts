// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import Segment from './segment.vue'

enableAutoUnmount(afterEach)

describe('Segment disabled choices', () => {
  it('exposes disabled option semantics and blocks mouse and keyboard selection', async () => {
    const wrapper = mount(Segment, {
      props: {
        modelValue: 'header',
        items: [
          { value: 'header', label: '顶栏' },
          { value: 'bottom', label: '侧栏底部', disabled: true },
        ],
      },
    })
    const bottom = wrapper.findAll('[role="tab"]')[1]
    if (!bottom) throw new Error('Bottom choice is missing')
    expect(bottom.attributes('aria-disabled')).toBe('true')
    await bottom.trigger('click')
    await bottom.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('honors a disabled control without erasing individual option state', () => {
    const wrapper = mount(Segment, {
      props: { disabled: true, items: [{ value: 'sidebar', label: '标准' }] },
    })
    expect(wrapper.get('[role="tab"]').attributes('aria-disabled')).toBe('true')
  })
})
