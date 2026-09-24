import {
  registerThemePalette,
  themePaletteKey,
  type ConfigProviderProps,
  type RuntimeThemePalette,
  type ThemeColorTokens,
  type ThemeColorValue,
} from '@jingwei/ui'

import {
  brandBasePalettes,
  serializeBrandThemeColor,
  type BrandSemanticOverrides,
  type BrandVisualTheme,
} from '../shared/index.js'

export function brandThemePalette(
  theme: BrandVisualTheme,
  target: 'base' | 'primary',
): RuntimeThemePalette | null {
  const custom = target === 'base' ? theme.customBasePalette : theme.customPrimaryPalette
  if (custom === null) return null
  return {
    name: custom.name,
    family:
      target === 'base' || brandBasePalettes.some((key) => key === theme.primaryPalette)
        ? 'neutral'
        : 'chromatic',
    colors: custom.colors,
  }
}

function paletteKey(theme: BrandVisualTheme, target: 'base' | 'primary'): string {
  const palette = brandThemePalette(theme, target)
  return palette === null
    ? target === 'base'
      ? theme.basePalette
      : theme.primaryPalette
    : themePaletteKey(palette, target)
}

/** Register the published palette keys before passing pure theme options to the provider. */
export function registerBrandThemePalettes(theme: BrandVisualTheme): void {
  for (const target of ['base', 'primary'] as const) {
    const palette = brandThemePalette(theme, target)
    if (palette !== null) registerThemePalette(palette, target)
  }
}

function colorOverrides(
  overrides: BrandSemanticOverrides,
  base: string,
  primary: string,
): Partial<ThemeColorTokens> {
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [
      key,
      serializeBrandThemeColor(value, base, primary) as ThemeColorValue,
    ]),
  )
}

/** Translate a published tenant contract into the UI engine's runtime theme options. */
export function brandThemeOptions(
  theme: BrandVisualTheme,
  size?: NonNullable<ConfigProviderProps['theme']>['size'],
  previewKeys: Partial<Record<'base' | 'primary', string>> = {},
): NonNullable<ConfigProviderProps['theme']> & { base: string; primary: string } {
  const base = previewKeys.base ?? paletteKey(theme, 'base')
  const primary = previewKeys.primary ?? paletteKey(theme, 'primary')
  return {
    base,
    primary,
    radius: theme.radius,
    sidebar: theme.sidebarScheme,
    sidebarDerive: true,
    feedback: theme.feedbackScheme,
    chart: theme.chartScheme,
    lightLevel: theme.lightLevel,
    darkLevel: theme.darkLevel,
    borderOpacity: theme.borderOpacity,
    overrides: {
      light: colorOverrides(theme.overrides.light, base, primary),
      dark: colorOverrides(theme.overrides.dark, base, primary),
    },
    ...(size === undefined ? {} : { size }),
  }
}
