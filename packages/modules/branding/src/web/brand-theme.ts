import type { ConfigProviderProps } from '@jingwei/ui'

import { resolveBrandThemeOptions } from '../shared/brand-theme-options.js'
import type { BrandVisualTheme } from '../shared/theme.js'

/** Translate the persisted V2 contract into native Vean options without registry mutation. */
export function brandThemeOptions(
  theme: BrandVisualTheme,
  size?: NonNullable<ConfigProviderProps['theme']>['size'],
): NonNullable<ConfigProviderProps['theme']> {
  return resolveBrandThemeOptions(theme, size)
}
