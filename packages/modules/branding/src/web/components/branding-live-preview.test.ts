// @vitest-environment happy-dom

import { getRegistry } from '@soybeanjs/theme'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { generateThemePaletteColors, getThemePaletteColors } from '@jingwei/ui/theme-palette'

import { defaultBrandConfiguration } from '../../shared/index.js'
import BrandingLivePreview from './branding-live-preview.vue'

describe('BrandingLivePreview', () => {
  it('shows the platform favicon when the tenant has not configured one', () => {
    const wrapper = shallowMount(BrandingLivePreview, {
      global: { stubs: { ThemeScope: { template: '<div><slot /></div>' } } },
      props: {
        preview: defaultBrandConfiguration,
        logoUrl: null,
        markUrl: null,
        faviconUrl: null,
        state: 'PLATFORM_DEFAULT',
      },
    })

    expect(wrapper.find('[data-brand-preview-favicon]').attributes('src')).toBe('/favicon.svg')
  })

  it('prefers the tenant favicon in the browser preview', () => {
    const wrapper = shallowMount(BrandingLivePreview, {
      global: { stubs: { ThemeScope: { template: '<div><slot /></div>' } } },
      props: {
        preview: defaultBrandConfiguration,
        logoUrl: null,
        markUrl: null,
        faviconUrl: 'data:image/png;base64,AA==',
        state: 'DRAFT',
      },
    })

    expect(wrapper.find('[data-brand-preview-favicon]').attributes('src')).toBe(
      'data:image/png;base64,AA==',
    )
  })

  it('updates a draft ramp in one registry slot and releases it on unmount', async () => {
    const registeredBefore = new Set(Object.keys(getRegistry().primary))
    const first = generateThemePaletteColors('#6366f1')
    const second = generateThemePaletteColors('#dc2626')
    const preview = {
      ...defaultBrandConfiguration,
      visualTheme: {
        ...defaultBrandConfiguration.visualTheme,
        customPrimaryPalette: {
          profile: 'OKLCH_PALETTE_V1' as const,
          name: '预览色板',
          seedColor: '#6366f1',
          colors: first,
        },
      },
    }
    const wrapper = shallowMount(BrandingLivePreview, {
      global: { stubs: { ThemeScope: { template: '<div><slot /></div>' } } },
      props: {
        preview,
        logoUrl: null,
        markUrl: null,
        faviconUrl: null,
        state: 'DRAFT',
      },
    })
    const slotKey = Object.keys(getRegistry().primary).find(
      (key) => key.startsWith('tenant-preview-primary-') && !registeredBefore.has(key),
    )
    if (slotKey === undefined) throw new Error('Preview palette slot was not registered')
    expect(getThemePaletteColors(slotKey, 'primary')[500]).toEqual(first[500])

    await wrapper.setProps({
      preview: {
        ...preview,
        visualTheme: {
          ...preview.visualTheme,
          customPrimaryPalette: { ...preview.visualTheme.customPrimaryPalette, colors: second },
        },
      },
    })
    expect(getThemePaletteColors(slotKey, 'primary')[500]).toEqual(second[500])

    wrapper.unmount()
    expect(getThemePaletteColors(slotKey, 'primary')).toEqual({})
  })
})
