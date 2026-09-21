// @vitest-environment happy-dom

import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { defaultBrandConfiguration } from '../../shared/index.js'
import BrandingLivePreview from './branding-live-preview.vue'

describe('BrandingLivePreview', () => {
  it('shows the platform favicon when the tenant has not configured one', () => {
    const wrapper = shallowMount(BrandingLivePreview, {
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
})
