import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { BrandWorkspaceDefaults } from '@jingwei/module-branding/shared'

export const LAYOUT_STORAGE_KEY = 'jingwei:layout:v2'

export type LayoutMode = 'left' | 'top'
export type BrandPlacement = 'header' | 'sider'

export interface LayoutPreferences {
  readonly mode: LayoutMode
  readonly brandPlacement: BrandPlacement
  readonly headerHeight: number
  readonly siderWidth: number
  readonly showTabs: boolean
  readonly siderCollapsed: boolean
}

export type LayoutPreferenceOverrides = Partial<LayoutPreferences>

export const defaultLayoutPreferences: LayoutPreferences = {
  mode: 'left',
  brandPlacement: 'header',
  headerHeight: 56,
  siderWidth: 220,
  showTabs: true,
  siderCollapsed: false,
}

const numericLimits = {
  headerHeight: { min: 48, max: 96 },
  siderWidth: { min: 192, max: 360 },
} as const

export function workspacePreferenceStorageKey(tenantId: string, userId: string): string {
  return `${LAYOUT_STORAGE_KEY}:${tenantId}:${userId}`
}

export function tenantLayoutDefaults(value: BrandWorkspaceDefaults): LayoutPreferences {
  return normalizeLayoutPreferences({
    mode: value.layoutMode,
    brandPlacement: value.brandPlacement,
    headerHeight: value.headerHeight,
    siderWidth: value.siderWidth,
    showTabs: value.showTabs,
    siderCollapsed: false,
  })
}

export function normalizeLayoutPreferences(
  value: unknown,
  fallback: LayoutPreferences = defaultLayoutPreferences,
): LayoutPreferences {
  if (!isRecord(value)) return { ...fallback }

  return {
    mode: value.mode === 'top' ? 'top' : value.mode === 'left' ? 'left' : fallback.mode,
    brandPlacement:
      value.brandPlacement === 'sider'
        ? 'sider'
        : value.brandPlacement === 'header'
          ? 'header'
          : fallback.brandPlacement,
    headerHeight: boundedNumber(
      value.headerHeight,
      numericLimits.headerHeight,
      fallback.headerHeight,
    ),
    siderWidth: boundedNumber(value.siderWidth, numericLimits.siderWidth, fallback.siderWidth),
    showTabs: typeof value.showTabs === 'boolean' ? value.showTabs : fallback.showTabs,
    siderCollapsed:
      typeof value.siderCollapsed === 'boolean' ? value.siderCollapsed : fallback.siderCollapsed,
  }
}

export function normalizeLayoutOverrides(
  value: unknown,
  defaults: LayoutPreferences,
): LayoutPreferenceOverrides {
  if (!isRecord(value)) return {}
  const resolved = normalizeLayoutPreferences(value, defaults)
  const overrides: LayoutPreferenceOverrides = {}
  for (const key of layoutPreferenceKeys) {
    if (!(key in value) || resolved[key] === defaults[key]) continue
    assignLayoutOverride(overrides, key, resolved[key])
  }
  return overrides
}

export function resolveLayoutPreferences(
  defaults: LayoutPreferences,
  overrides: LayoutPreferenceOverrides,
): LayoutPreferences {
  return normalizeLayoutPreferences({ ...defaults, ...overrides }, defaults)
}

export const useLayoutStore = defineStore('layout', () => {
  const defaults = ref<LayoutPreferences>({ ...defaultLayoutPreferences })
  const overrides = ref<LayoutPreferenceOverrides>({})
  const storageKey = ref<string | null>(null)

  const preferences = computed<LayoutPreferences>(() =>
    resolveLayoutPreferences(defaults.value, overrides.value),
  )
  const hasOverrides = computed(() => Object.keys(overrides.value).length > 0)

  const siderOpen = computed({
    get: () => !preferences.value.siderCollapsed,
    set: (open: boolean) => patch({ siderCollapsed: !open }),
  })

  function setTenantDefaults(value: BrandWorkspaceDefaults): void {
    defaults.value = tenantLayoutDefaults(value)
    overrides.value = normalizeLayoutOverrides(overrides.value, defaults.value)
    persistOverrides()
  }

  function setUserScope(tenantId: string | null, userId: string | null): void {
    storageKey.value =
      tenantId === null || userId === null ? null : workspacePreferenceStorageKey(tenantId, userId)
    overrides.value = readOverrides(storageKey.value, defaults.value)
  }

  function patch(value: Partial<LayoutPreferences>): void {
    overrides.value = normalizeLayoutOverrides({ ...preferences.value, ...value }, defaults.value)
    persistOverrides()
  }

  function reset(): void {
    overrides.value = {}
    persistOverrides()
  }

  function persistOverrides(): void {
    const storage = browserStorage()
    if (storageKey.value === null || storage === null) return
    if (Object.keys(overrides.value).length === 0) {
      storage.removeItem(storageKey.value)
      return
    }
    storage.setItem(storageKey.value, JSON.stringify({ version: 2, overrides: overrides.value }))
  }

  return {
    preferences,
    tenantDefaults: computed(() => defaults.value),
    userOverrides: computed(() => overrides.value),
    hasOverrides,
    siderOpen,
    setTenantDefaults,
    setUserScope,
    patch,
    reset,
  }
})

const layoutPreferenceKeys = [
  'mode',
  'brandPlacement',
  'headerHeight',
  'siderWidth',
  'showTabs',
  'siderCollapsed',
] as const

function assignLayoutOverride<Key extends keyof LayoutPreferences>(
  overrides: LayoutPreferenceOverrides,
  key: Key,
  value: LayoutPreferences[Key],
): void {
  Object.assign(overrides, { [key]: value })
}

function readOverrides(key: string | null, defaults: LayoutPreferences): LayoutPreferenceOverrides {
  const storage = browserStorage()
  if (key === null || storage === null) return {}
  const stored = storage.getItem(key)
  if (stored === null) return {}
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!isRecord(parsed) || parsed.version !== 2) return {}
    return normalizeLayoutOverrides(parsed.overrides, defaults)
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedNumber(
  value: unknown,
  limits: { readonly min: number; readonly max: number },
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)))
}

function browserStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
    ? localStorage
    : null
}
