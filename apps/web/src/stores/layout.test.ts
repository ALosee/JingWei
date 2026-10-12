import { describe, expect, it } from 'vitest'

import {
  defaultLayoutPreferences,
  normalizeLayoutOverrides,
  normalizeLayoutPreferences,
  resolveLayoutPreferences,
  tenantLayoutDefaults,
  workspacePreferenceStorageKey,
} from './layout.js'

describe('layout preferences', () => {
  it('defaults to the standard sidebar with its brand at the top', () => {
    expect(defaultLayoutPreferences).toMatchObject({
      sidebarVariant: 'sidebar',
      brandPlacement: 'sider',
    })
  })
  it.each(['sidebar', 'floating', 'inset'])(
    'restores %s and bottom branding while preserving sparse overrides',
    (sidebarVariant) => {
      expect(
        normalizeLayoutPreferences({ sidebarVariant, brandPlacement: 'sider-bottom' }),
      ).toMatchObject({ sidebarVariant, brandPlacement: 'sider-bottom' })
      expect(
        normalizeLayoutOverrides(
          { sidebarVariant, brandPlacement: 'sider-bottom' },
          defaultLayoutPreferences,
        ),
      ).toMatchObject({ brandPlacement: 'sider-bottom' })
    },
  )
  it.each([
    'dual-vertical',
    'vertical-horizontal',
    'horizontal-vertical',
    'horizontal-dual-vertical',
  ])('restores %s from scoped preferences', (mode) => {
    expect(normalizeLayoutPreferences({ mode }).mode).toBe(mode)
  })
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
      sidebarVariant: 'sidebar',
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
      brandPlacement: 'header',
      siderWidth: 280,
    })
  })

  it('stores only values that differ from the tenant defaults', () => {
    const defaults = tenantLayoutDefaults({
      layoutMode: 'top',
      sidebarVariant: 'sidebar',
      brandPlacement: 'header',
      headerHeight: 64,
      siderWidth: 240,
      showTabs: false,
    })

    expect(
      normalizeLayoutOverrides(
        { ...defaults, mode: 'left', siderWidth: 240, siderCollapsed: true },
        defaults,
      ),
    ).toEqual({ mode: 'left', siderCollapsed: true })
  })

  it('keeps explicit overrides while inheriting later tenant default changes', () => {
    const overrides = { mode: 'top' as const }
    expect(
      resolveLayoutPreferences(
        { ...defaultLayoutPreferences, showTabs: false, siderWidth: 280 },
        overrides,
      ),
    ).toMatchObject({ mode: 'top', showTabs: false, siderWidth: 280 })
  })

  it('isolates browser preferences by tenant and user', () => {
    expect(workspacePreferenceStorageKey('tenant-a', 'user-a')).not.toBe(
      workspacePreferenceStorageKey('tenant-b', 'user-a'),
    )
    expect(workspacePreferenceStorageKey('tenant-a', 'user-a')).not.toBe(
      workspacePreferenceStorageKey('tenant-a', 'user-b'),
    )
  })
})
