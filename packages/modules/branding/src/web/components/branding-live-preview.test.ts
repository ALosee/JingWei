// @vitest-environment happy-dom

import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ThemeScope } from '@jingwei/ui'
import { generateThemePaletteColors } from '@jingwei/ui/theme-palette'

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

  it('updates controlled draft colors without registering global theme state', async () => {
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
      props: { preview, logoUrl: null, markUrl: null, faviconUrl: null, state: 'DRAFT' },
    })
    expect(wrapper.getComponent(ThemeScope).props('theme')?.overrides?.light?.primary).toBe(
      first[500].hsl,
    )
    await wrapper.setProps({
      preview: {
        ...preview,
        visualTheme: {
          ...preview.visualTheme,
          customPrimaryPalette: { ...preview.visualTheme.customPrimaryPalette, colors: second },
        },
      },
    })
    expect(wrapper.getComponent(ThemeScope).props('theme')?.overrides?.light?.primary).toBe(
      second[500].hsl,
    )
    wrapper.unmount()
  })
})
