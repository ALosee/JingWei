import type { PaletteLevel } from '@vean/theme'

import type { ThemeSize } from '../../theme'
import type { ThemePaletteColors } from './theme-palette'

export interface ThemePaletteSelectItem {
  value: string
  label: string
  colors: Partial<ThemePaletteColors>
}

export interface ThemePaletteSelectProps {
  modelValue: string
  items: ThemePaletteSelectItem[]
  disabled?: boolean
  size?: ThemeSize
  decorateLevels?: PaletteLevel[]
}
