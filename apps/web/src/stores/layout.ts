import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const LAYOUT_STORAGE_KEY = 'jingwei:layout:v1'

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

export function normalizeLayoutPreferences(value: unknown): LayoutPreferences {
  if (!isRecord(value)) return { ...defaultLayoutPreferences }

  return {
    mode: value.mode === 'top' ? 'top' : 'left',
    brandPlacement: value.brandPlacement === 'sider' ? 'sider' : 'header',
    headerHeight: boundedNumber(
      value.headerHeight,
      numericLimits.headerHeight,
      defaultLayoutPreferences.headerHeight,
    ),
    siderWidth: boundedNumber(
      value.siderWidth,
      numericLimits.siderWidth,
      defaultLayoutPreferences.siderWidth,
    ),
    showTabs:
      typeof value.showTabs === 'boolean' ? value.showTabs : defaultLayoutPreferences.showTabs,
    siderCollapsed:
      typeof value.siderCollapsed === 'boolean'
        ? value.siderCollapsed
        : defaultLayoutPreferences.siderCollapsed,
  }
}

export const useLayoutStore = defineStore('layout', () => {
  const persisted = useStorage<unknown>(LAYOUT_STORAGE_KEY, { ...defaultLayoutPreferences })

  const preferences = computed<LayoutPreferences>({
    get: () => normalizeLayoutPreferences(persisted.value),
    set: (value) => {
      persisted.value = normalizeLayoutPreferences(value)
    },
  })

  const siderOpen = computed({
    get: () => !preferences.value.siderCollapsed,
    set: (open: boolean) => patch({ siderCollapsed: !open }),
  })

  function patch(value: Partial<LayoutPreferences>): void {
    preferences.value = { ...preferences.value, ...value }
  }

  function reset(): void {
    preferences.value = { ...defaultLayoutPreferences }
  }

  return { preferences, siderOpen, patch, reset }
})

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
