import { describe, expect, it } from 'vitest'

import { defaultLayoutPreferences, normalizeLayoutPreferences } from './layout.js'

describe('layout preferences', () => {
  it('falls back when persisted data is not an object', () => {
    expect(normalizeLayoutPreferences('{broken')).toEqual(defaultLayoutPreferences)
  })

  it('preserves supported values and clamps dimensions', () => {
    expect(
      normalizeLayoutPreferences({
        mode: 'top',
        brandPlacement: 'sider',
        headerHeight: 200,
        siderWidth: 100,
        showTabs: false,
        siderCollapsed: true,
      }),
    ).toEqual({
      mode: 'top',
      brandPlacement: 'sider',
      headerHeight: 96,
      siderWidth: 192,
      showTabs: false,
      siderCollapsed: true,
    })
  })

  it('repairs fields independently instead of discarding usable preferences', () => {
    expect(
      normalizeLayoutPreferences({
        mode: 'unknown',
        brandPlacement: 'header',
        headerHeight: Number.NaN,
        siderWidth: 280.4,
        showTabs: true,
      }),
    ).toEqual({
      ...defaultLayoutPreferences,
      siderWidth: 280,
    })
  })
})
