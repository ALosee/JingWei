// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY } from '@jingwei/ui/theme-init'

import {
  appearancePreferenceStorageKey,
  defaultAppearancePreferences,
  normalizeAppearancePreferences,
  useAppearanceStore,
} from './appearance.js'

describe('appearance preferences', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    setActivePinia(createPinia())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('keeps only supported mode and size values', () => {
    expect(normalizeAppearancePreferences({ mode: 'auto', size: 'lg' })).toEqual({
      mode: 'auto',
      size: 'lg',
    })
    expect(normalizeAppearancePreferences({ mode: 'sepia', size: 99 })).toEqual(
      defaultAppearancePreferences,
    )
  })

  it('uses a tenant and user scoped storage key', () => {
    expect(appearancePreferenceStorageKey('tenant-a', 'user-a')).toBe(
      'jingwei:appearance:v2:tenant-a:user-a',
    )
  })

  it('does not import an unscoped legacy preference into another account', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: 'dark', size: 'xl' }))
    const appearance = useAppearanceStore()

    appearance.setUserScope('tenant-a', 'user-a')
    expect(appearance.preferences).toEqual(defaultAppearancePreferences)

    appearance.patch({ mode: 'auto', size: 'sm' })
    appearance.setUserScope('tenant-a', 'user-b')
    expect(appearance.preferences).toEqual(defaultAppearancePreferences)

    appearance.setUserScope('tenant-a', 'user-a')
    expect(appearance.preferences).toEqual({ mode: 'auto', size: 'sm' })
    appearance.setUserScope(null, null)
    expect(appearance.preferences).toEqual(defaultAppearancePreferences)
  })
})
