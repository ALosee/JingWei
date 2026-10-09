import type {
  PaletteKey,
  ThemeMode,
  ThemeModePreference,
  ThemeRadiusValue,
  ThemeSizeValue,
  ThemeSpacingValue,
} from '@vean/theme'
import type { ComputedRef, Ref, ShallowRef } from 'vue'

import type { ThemeSettingsState } from '../../theme/settings-types'
import type { RuntimeThemeOptions, ThemePresetColors } from '../../theme/types'

export interface ThemeContext {
  /** The base color palette key. */
  base: ShallowRef<PaletteKey>
  /** The primary color palette key. */
  primary: ShallowRef<PaletteKey>
  /** The border radius. */
  radius: ShallowRef<ThemeRadiusValue>
  /** The component size / density. */
  size: ShallowRef<ThemeSizeValue>
  /** The spacing grid unit multiplier (padding / margin / gap). */
  spacing: ShallowRef<ThemeSpacingValue>
  /** The color scheme preference (`light` / `dark` / `auto`). */
  mode: ShallowRef<ThemeModePreference>
  /** The effective (resolved) color scheme: `auto` follows the OS preference. */
  effectiveMode: ComputedRef<ThemeMode>
  /** Set the border radius. */
  setRadius: (value: ThemeRadiusValue) => void
  /** Set the component size / density. */
  setSize: (value: ThemeSizeValue) => void
  /** Set the spacing grid unit multiplier. */
  setSpacing: (value: ThemeSpacingValue) => void
  /** Set the color scheme preference. */
  setMode: (value: ThemeModePreference) => void
  /** The persisted custom theme presets table. */
  customPresets: Ref<Record<string, ThemePresetColors>>
  /** The currently applied custom preset name, if any. */
  appliedPresetName: ShallowRef<string | null>
  /** Save the current primary color as a custom preset. */
  savePreset: (name: string) => boolean
  /** Remove a custom preset. */
  removePreset: (name: string) => boolean
  /** Apply a custom preset by name. */
  applyPreset: (name: string) => void
  /** Clear the applied custom preset. */
  resetPreset: () => void
  /** Overwrite the full persistable theme state (options + mode). */
  setThemeState: (config: ThemeSettingsState) => void
  /** The effective theme merged from the internal state and the `theme` prop. */
  theme: ComputedRef<RuntimeThemeOptions>
}
