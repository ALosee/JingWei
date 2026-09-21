// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DefaultBrandMark from './default-brand-mark.vue'

describe('DefaultBrandMark', () => {
  it('renders the Jingwei coordinate symbol', () => {
    const wrapper = mount(DefaultBrandMark)
    const symbol = wrapper.find('svg')

    expect(symbol.attributes('data-brand-symbol')).toBe('jingwei-coordinate')
    expect(symbol.attributes('viewBox')).toBe('0 0 48 48')
    expect(wrapper.find('[data-brand-coordinate-axis]').exists()).toBe(true)
    expect(wrapper.find('[data-brand-coordinate-center]').exists()).toBe(true)
  })
})
