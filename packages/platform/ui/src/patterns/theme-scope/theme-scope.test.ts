// @vitest-environment happy-dom

import type { ColorValue } from '@vean/theme'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { generateThemePaletteColors } from '../theme-palette/theme-palette.js'
import { ThemeScope } from './theme-scope.js'

describe('ThemeScope', () => {
  it('scopes generated theme variables without replacing the application root theme', () => {
    const wrapper = mount(ThemeScope, {
      props: { theme: { base: 'stone', primary: 'rose', radius: 'lg' } },
      slots: { default: '<button data-preview-button>Preview</button>' },
    })

    const scope = wrapper.find('[data-ui-theme-scope]')
    const id = scope.attributes('data-ui-theme-scope')
    const css = wrapper.find('style').text()
    expect(scope.find('[data-preview-button]').exists()).toBe(true)
    expect(css).toContain(`[data-ui-theme-scope="${id}"]`)
    expect(css).not.toContain(':root')
  })

  it('regenerates scoped CSS when controlled draft colors change', async () => {
    const first = generateThemePaletteColors('#6366f1')[500].hsl as ColorValue
    const second = generateThemePaletteColors('#dc2626')[500].hsl as ColorValue
    const wrapper = mount(ThemeScope, {
      props: {
        theme: { base: 'zinc', primary: 'indigo', overrides: { light: { primary: first } } },
      },
    })
    const originalCss = wrapper.find('style').text()
    await wrapper.setProps({
      theme: { base: 'zinc', primary: 'indigo', overrides: { light: { primary: second } } },
    })
    expect(wrapper.find('style').text()).not.toBe(originalCss)
    wrapper.unmount()
  })
})
