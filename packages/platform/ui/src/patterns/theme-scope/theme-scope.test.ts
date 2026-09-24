// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  createThemePaletteSlot,
  generateThemePaletteColors,
} from '../theme-palette/theme-palette.js'
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

  it('regenerates scoped CSS when a preview slot is updated in place', async () => {
    const slot = createThemePaletteSlot('primary')
    try {
      slot.update({
        name: 'Draft',
        family: 'chromatic',
        colors: generateThemePaletteColors('#6366f1'),
      })
      const wrapper = mount(ThemeScope, {
        props: { theme: { base: 'zinc', primary: slot.key } },
      })
      const originalCss = wrapper.find('style').text()

      slot.update({
        name: 'Draft',
        family: 'chromatic',
        colors: generateThemePaletteColors('#dc2626'),
      })
      await wrapper.setProps({ theme: { base: 'zinc', primary: slot.key } })
      expect(wrapper.find('style').text()).not.toBe(originalCss)
      wrapper.unmount()
    } finally {
      slot.dispose()
    }
  })
})
