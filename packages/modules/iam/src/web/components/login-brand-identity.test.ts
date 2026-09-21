// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, readonly, ref } from 'vue'

import {
  authBrandPresentationKey,
  authPlatformMarkComponentKey,
  type AuthBrandPresentation,
} from '../auth-brand-presentation.js'
import LoginBrandIdentity from './login-brand-identity.vue'

const defaultBrand: AuthBrandPresentation = {
  systemName: '经纬企业平台',
  shortName: '经纬',
  loginTitle: '经纬企业平台',
  loginTagline: '让组织、权限与业务边界保持清晰，让每一次协作都有迹可循。',
  logoUrl: null,
  markUrl: null,
  horizontalBrandMode: 'SHORT_NAME',
  logoColorMode: 'FOLLOW_THEME',
}
const platformMark = defineComponent({
  name: 'PlatformMarkStub',
  setup: () => () => h('svg', { 'data-platform-mark': '' }),
})

describe('LoginBrandIdentity', () => {
  it('uses the platform mark supplied by the application composition root', () => {
    const wrapper = mount(LoginBrandIdentity, {
      props: { surface: 'canvas' },
      global: {
        provide: {
          [authBrandPresentationKey as symbol]: readonly(ref(defaultBrand)),
          [authPlatformMarkComponentKey as symbol]: platformMark,
        },
      },
    })

    expect(wrapper.find('[data-platform-mark]').exists()).toBe(true)
  })

  it('derives a tenant-safe monogram when the platform mark is unavailable', () => {
    const wrapper = mount(LoginBrandIdentity, {
      props: { surface: 'canvas' },
      global: {
        provide: {
          [authBrandPresentationKey as symbol]: readonly(
            ref({ ...defaultBrand, shortName: '审核平台' }),
          ),
        },
      },
    })

    expect(wrapper.find('[data-auth-brand-monogram]').text()).toBe('审')
  })

  it('prefers a tenant mark over the injected platform mark', () => {
    const wrapper = mount(LoginBrandIdentity, {
      props: { surface: 'surface' },
      global: {
        provide: {
          [authBrandPresentationKey as symbol]: readonly(
            ref({ ...defaultBrand, markUrl: 'data:image/png;base64,AA==' }),
          ),
          [authPlatformMarkComponentKey as symbol]: platformMark,
        },
      },
    })

    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,AA==')
    expect(wrapper.find('[data-platform-mark]').exists()).toBe(false)
  })
})
