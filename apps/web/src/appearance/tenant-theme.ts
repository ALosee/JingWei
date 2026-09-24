import type { BrandVisualTheme } from '@jingwei/module-branding/shared'
import { brandThemeOptions } from '@jingwei/module-branding/web'
import type { ConfigProviderProps } from '@jingwei/ui'

import type { ThemeSizePreference } from '../stores/appearance.js'

export function tenantThemeOptions(
  theme: BrandVisualTheme,
  size: ThemeSizePreference,
): NonNullable<ConfigProviderProps['theme']> {
  return brandThemeOptions(theme, size)
}
