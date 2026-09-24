import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const APPEARANCE_STORAGE_KEY = 'jingwei:appearance:v2'
export const APPEARANCE_MODE_STORAGE_KEY = 'jingwei:appearance-mode:v1'

export const themeModePreferences = ['auto', 'light', 'dark'] as const
export const themeSizePreferences = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export type ThemeModePreference = (typeof themeModePreferences)[number]
export type ThemeSizePreference = (typeof themeSizePreferences)[number]

export interface AppearancePreferences {
  readonly mode: ThemeModePreference
  readonly size: ThemeSizePreference
}

export const defaultAppearancePreferences: AppearancePreferences = {
  mode: 'light',
  size: 'md',
}

export function appearancePreferenceStorageKey(tenantId: string, userId: string): string {
  return `${APPEARANCE_STORAGE_KEY}:${tenantId}:${userId}`
}

export function normalizeAppearancePreferences(value: unknown): AppearancePreferences {
  if (!isRecord(value)) return { ...defaultAppearancePreferences }
  return {
    mode: isThemeMode(value.mode) ? value.mode : defaultAppearancePreferences.mode,
    size: isThemeSize(value.size) ? value.size : defaultAppearancePreferences.size,
  }
}

export const useAppearanceStore = defineStore('appearance', () => {
  const preferences = ref<AppearancePreferences>({ ...defaultAppearancePreferences })
  const storageKey = ref<string | null>(null)

  function setUserScope(tenantId: string | null, userId: string | null): void {
    storageKey.value =
      tenantId === null || userId === null ? null : appearancePreferenceStorageKey(tenantId, userId)
    preferences.value = readPreferences(storageKey.value)
    persistPreferences()
    persistModeHint(preferences.value.mode)
  }

  function patch(value: Partial<AppearancePreferences>): void {
    preferences.value = normalizeAppearancePreferences({ ...preferences.value, ...value })
    persistPreferences()
    persistModeHint(preferences.value.mode)
  }

  function reset(): void {
    preferences.value = { ...defaultAppearancePreferences }
    persistPreferences()
    persistModeHint(preferences.value.mode)
  }

  function persistPreferences(): void {
    const storage = browserStorage()
    if (storageKey.value === null || storage === null) return
    storage.setItem(storageKey.value, JSON.stringify({ version: 2, ...preferences.value }))
  }

  return {
    preferences: computed(() => preferences.value),
    setUserScope,
    patch,
    reset,
  }
})

function readPreferences(key: string | null): AppearancePreferences {
  const storage = browserStorage()
  if (storage === null || key === null) return { ...defaultAppearancePreferences }
  const stored = parseJson(storage.getItem(key))
  return isRecord(stored) && stored.version === 2
    ? normalizeAppearancePreferences(stored)
    : { ...defaultAppearancePreferences }
}

function persistModeHint(mode: ThemeModePreference): void {
  browserStorage()?.setItem(APPEARANCE_MODE_STORAGE_KEY, mode)
}

function parseJson(value: string | null): unknown {
  if (value === null) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function isThemeMode(value: unknown): value is ThemeModePreference {
  return themeModePreferences.some((mode) => mode === value)
}

function isThemeSize(value: unknown): value is ThemeSizePreference {
  return themeSizePreferences.some((size) => size === value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function browserStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return typeof localStorage.getItem === 'function' && typeof localStorage.setItem === 'function'
    ? localStorage
    : null
}
