import { describe, expect, it } from 'vitest'

import { defaultLayoutPreferences } from '../../stores/layout.js'
import { getLayoutModeDefinition } from './layout-mode-registry.js'

describe('layout mode registry', () => {
  it('places a header brand above the left sidebar and content', () => {
    const definition = getLayoutModeDefinition('left')
    const context = {
      preferences: { ...defaultLayoutPreferences, brandPlacement: 'header' as const },
      isMobile: false,
    }

    expect(definition.orientation(context)).toBe('vertical')
    expect(definition.sidebarVisible).toBe(true)
    expect(definition.showHeaderBrand(context)).toBe(true)
    expect(definition.showSiderBrand(context)).toBe(false)
  })

  it('keeps a sider brand beside the left workspace', () => {
    const definition = getLayoutModeDefinition('left')
    const context = {
      preferences: { ...defaultLayoutPreferences, brandPlacement: 'sider' as const },
      isMobile: false,
    }

    expect(definition.orientation(context)).toBe('horizontal')
    expect(definition.showHeaderBrand(context)).toBe(false)
    expect(definition.showSiderBrand(context)).toBe(true)
  })

  it('defines top mode without a sidebar', () => {
    const definition = getLayoutModeDefinition('top')
    const context = { preferences: defaultLayoutPreferences, isMobile: false }

    expect(definition.orientation(context)).toBe('vertical')
    expect(definition.sidebarVisible).toBe(false)
    expect(definition.showHeaderBrand(context)).toBe(true)
    expect(definition.showSiderBrand(context)).toBe(false)
  })
})
