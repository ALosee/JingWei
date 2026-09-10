// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ButtonLoading from './button-loading.vue'
import Button from './button.vue'

describe('Button', () => {
  it('uses a safe native type and emits clicks', async () => {
    const wrapper = mount(Button, { slots: { default: '保存' } })

    expect(wrapper.get('button').attributes('type')).toBe('button')

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('blocks interaction while disabled', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})

describe('ButtonLoading', () => {
  it('exposes loading as an accessible disabled state', async () => {
    const wrapper = mount(ButtonLoading, {
      global: { stubs: { SIcon: true } },
      props: { loading: true },
      slots: { default: '登录' },
    })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
  })

  it('invokes an async click handler once and remains busy until it resolves', async () => {
    let complete!: () => void
    const pending = new Promise<void>((resolve) => {
      complete = resolve
    })
    const onClick = vi.fn(() => pending)
    const wrapper = mount(ButtonLoading, {
      attrs: { onClick },
      global: { stubs: { SIcon: true } },
      props: { autoLoading: true },
      slots: { default: '提交' },
    })

    await wrapper.trigger('click')

    expect(onClick).toHaveBeenCalledOnce()
    expect(wrapper.attributes('aria-busy')).toBe('true')

    complete()
    await flushPromises()
    await nextTick()

    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })
})
