// @vitest-environment happy-dom

import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { generateThemePaletteColors } from '@jingwei/ui/theme-palette'

import { defaultBrandConfiguration } from '../../shared/index.js'
import BrandingSemanticColorPicker from './branding-semantic-color-picker.vue'

describe('BrandingSemanticColorPicker', () => {
  it('selects multiple custom shades from one unchanged seed', async () => {
    const seed = 'hsl(240 50% 50%)'
    const wrapper = shallowMount(BrandingSemanticColorPicker, {
      props: {
        modelValue: { kind: 'LITERAL', value: seed },
        theme: defaultBrandConfiguration.visualTheme,
        disabled: false,
      },
    })

    await wrapper.get('[aria-label="选择自定义 700 色阶"]').trigger('click')
    await wrapper.get('[aria-label="选择自定义 900 色阶"]').trigger('click')

    const changes = wrapper.emitted('update:modelValue')
    expect(changes?.[0]?.[0]).toEqual({
      kind: 'LITERAL',
      value: generateThemePaletteColors(seed)[700].hsl,
    })
    expect(changes?.[1]?.[0]).toEqual({
      kind: 'LITERAL',
      value: generateThemePaletteColors(seed)[900].hsl,
    })
  })

  it('keeps a current tenant palette reference when selecting another level', async () => {
    const theme = {
      ...defaultBrandConfiguration.visualTheme,
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1' as const,
        name: '品牌色',
        seedColor: '#6366f1',
        colors: generateThemePaletteColors('#6366f1'),
      },
    }
    const wrapper = shallowMount(BrandingSemanticColorPicker, {
      props: {
        modelValue: { kind: 'PALETTE', palette: 'PRIMARY', level: 500 },
        theme,
        disabled: false,
      },
    })

    await wrapper.get('[aria-label="选择 700 色阶"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual({
      kind: 'PALETTE',
      palette: 'PRIMARY',
      level: 700,
    })
  })
})
