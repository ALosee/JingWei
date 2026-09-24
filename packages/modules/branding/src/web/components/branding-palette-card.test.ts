// @vitest-environment happy-dom

import { tailwindPalette } from '@soybeanjs/colord/palette'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { defaultBrandConfiguration, type BrandVisualTheme } from '../../shared/index.js'
import BrandingPaletteCard from './branding-palette-card.vue'

const stubs = {
  SButton: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
  SDialog: { template: '<div role="dialog"><slot /></div>' },
  SColorPicker: {
    props: ['open'],
    template:
      '<button type="button" :data-open="open" @click="$emit(\'update:modelValue\', \'#445566\')">取色</button>',
  },
}

describe('BrandingPaletteCard', () => {
  it('applies a brand shade without creating another palette', async () => {
    const wrapper = shallowMount(BrandingPaletteCard, {
      props: {
        modelValue: defaultBrandConfiguration.visualTheme,
        target: 'primary',
        mode: 'light',
        disabled: false,
      },
      global: { stubs },
    })

    await wrapper.get('[aria-label="将主色设为 700 色阶"]').trigger('click')
    const change = wrapper.emitted('update:modelValue')?.[0]?.[0] as BrandVisualTheme
    expect(change.overrides.light.primary).toEqual({
      kind: 'PALETTE',
      palette: 'PRIMARY',
      level: 700,
    })
    expect(change.customPrimaryPalette).toBeNull()
  })

  it('opens neutral ramp tuning without changing the draft', async () => {
    const wrapper = shallowMount(BrandingPaletteCard, {
      props: {
        modelValue: defaultBrandConfiguration.visualTheme,
        target: 'base',
        mode: 'light',
        disabled: false,
      },
      global: { stubs },
    })
    expect(wrapper.attributes('data-brand-palette-card')).toBe('base')
    expect(wrapper.text()).toContain('基础中性色')
    expect(wrapper.text()).toContain('页面、卡片与浮层')

    await wrapper.get('[data-ramp-edit]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.get('[aria-label="编辑 700 色阶"]').trigger('click')
    expect(wrapper.get('[data-ramp-color-picker] button').attributes('data-open')).toBe('true')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('[data-ramp-color-picker] button').trigger('click')
    const change = wrapper.emitted('update:modelValue')?.[0]?.[0] as BrandVisualTheme
    expect(change.customBasePalette?.colors[700].hsl).not.toBe(tailwindPalette.zinc[700].hsl)
    expect(change.customBasePalette?.colors[500]).toEqual({
      hsl: tailwindPalette.zinc[500].hsl,
      oklch: tailwindPalette.zinc[500].oklch,
    })
  })

  it('shows the actual dark result of a light shade and offers a direct adjustment', async () => {
    const theme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      overrides: {
        light: { primary: { kind: 'PALETTE', palette: 'PRIMARY', level: 800 } },
        dark: {},
      },
    }
    const wrapper = shallowMount(BrandingPaletteCard, {
      props: { modelValue: theme, target: 'primary', mode: 'light', disabled: false },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('深色实际效果')
    expect(wrapper.text()).toContain('1.78:1')
    expect(wrapper.text()).toContain('低于 3:1')
    await wrapper.get('[data-switch-dark]').trigger('click')
    expect(wrapper.emitted('update:mode')?.[0]).toEqual(['dark'])
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[data-switch-dark]').text()).toBe('查看深色')
  })
})
