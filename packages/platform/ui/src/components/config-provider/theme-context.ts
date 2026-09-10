import type {
  BaseColorKey,
  PrimaryColorKey,
  ThemeMode,
  ThemeModePreference,
  ThemeOptions,
  ThemeRadiusValue,
  ThemeSizeValue,
} from '@soybeanjs/theme'
import type { StoredThemePreset, ThemeConfigState } from '@soybeanjs/theme/storage'
import type { ComputedRef, Ref, ShallowRef } from 'vue'

/** Reactive theme state exposed by the local ConfigProvider. */
export interface ThemeContext {
  base: ShallowRef<BaseColorKey>
  primary: ShallowRef<PrimaryColorKey>
  radius: ShallowRef<ThemeRadiusValue>
  size: ShallowRef<ThemeSizeValue>
  mode: ShallowRef<ThemeModePreference>
  effectiveMode: ComputedRef<ThemeMode>
  setRadius: (value: ThemeRadiusValue) => void
  setSize: (value: ThemeSizeValue) => void
  setMode: (value: ThemeModePreference) => void
  customPresets: Ref<Record<string, StoredThemePreset>>
  appliedPresetName: ShallowRef<string | null>
  savePreset: (name: string) => boolean
  removePreset: (name: string) => boolean
  applyPreset: (name: string) => void
  resetPreset: () => void
  setThemeState: (config: ThemeConfigState) => void
  theme: ComputedRef<ThemeOptions>
}

/** Internal storage synchronization capabilities owned by ConfigProvider. */
export type ConfigProviderThemeContext = ThemeContext & {
  refreshThemeConfig: () => void
  refreshPresetsSnapshot: () => void
}
