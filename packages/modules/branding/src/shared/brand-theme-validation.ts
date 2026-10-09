import { colord, extend } from '@soybeanjs/colord'
import a11yPlugin from '@soybeanjs/colord/plugins/a11y'
import oklabPlugin from '@soybeanjs/colord/plugins/oklab'

import { resolveBrandThemeColor } from './brand-theme-options.js'
import type { BrandCustomPalette, BrandSemanticOverrides, BrandVisualTheme } from './theme.js'

extend([a11yPlugin, oklabPlugin])

const contrastPairs = [
  ['background', 'foreground'],
  ['card', 'cardForeground'],
  ['popover', 'popoverForeground'],
  ['primary', 'primaryForeground'],
  ['secondary', 'secondaryForeground'],
  ['muted', 'mutedForeground'],
  ['accent', 'accentForeground'],
  ['destructive', 'destructiveForeground'],
  ['sidebar', 'sidebarForeground'],
  ['sidebarPrimary', 'sidebarPrimaryForeground'],
  ['sidebarAccent', 'sidebarAccentForeground'],
  ['success', 'successForeground'],
  ['warning', 'warningForeground'],
  ['info', 'infoForeground'],
  ['carbon', 'carbonForeground'],
] as const

export type BrandThemeContrastSurface = (typeof contrastPairs)[number][0]

export interface BrandThemeContrast {
  readonly surfaceColor: string
  readonly foregroundColor: string
  readonly ratio: number
}

/** Inspect the same effective pair used by publication checks, including CSS dark inheritance. */
export function inspectBrandThemePair(
  theme: BrandVisualTheme,
  mode: 'light' | 'dark',
  surfaceKey: BrandThemeContrastSurface,
): BrandThemeContrast | null {
  const pair = contrastPairs.find(([key]) => key === surfaceKey)
  if (pair === undefined) return null
  const surfaceColor = resolveBrandThemeColor(theme, mode, pair[0])
  // A transparent surface has no fixed backdrop; inherited dark transparency
  // follows the same publication rule as an explicit transparent surface.
  if (colord(surfaceColor).alpha() === 0) return null
  const foregroundColor = resolveBrandThemeColor(theme, mode, pair[1])
  return { surfaceColor, foregroundColor, ratio: colord(surfaceColor).contrast(foregroundColor) }
}

function validateRamp(name: string, palette: BrandCustomPalette | null, issues: string[]): void {
  if (palette === null) return
  let previous = Number.POSITIVE_INFINITY
  for (const [level, color] of Object.entries(palette.colors)) {
    const parsed = colord(color.hsl)
    const alternate = colord(color.oklch)
    if (!parsed.isValid() || !alternate.isValid()) {
      issues.push(`${name} ${level} 不是有效颜色`)
      continue
    }
    const hslRgb = parsed.toRgb()
    const oklchRgb = alternate.toRgb()
    if (
      Math.max(
        Math.abs(hslRgb.r - oklchRgb.r),
        Math.abs(hslRgb.g - oklchRgb.g),
        Math.abs(hslRgb.b - oklchRgb.b),
      ) > 4
    )
      issues.push(`${name} ${level} 的 HSL 与 OKLCH 不一致`)
    const luminance = parsed.luminance()
    if (luminance >= previous) issues.push(`${name} 色阶必须从 50 到 950 逐步变深`)
    previous = luminance
  }
}

function validateMode(
  theme: BrandVisualTheme,
  mode: '浅色' | '深色',
  overrides: BrandSemanticOverrides,
  issues: string[],
): void {
  for (const [surfaceKey, foregroundKey] of contrastPairs) {
    const surface = overrides[surfaceKey]
    const foreground = overrides[foregroundKey]
    const lightInfluencesDark =
      mode === '深色' &&
      (theme.overrides.light[surfaceKey] !== undefined ||
        theme.overrides.light[foregroundKey] !== undefined)
    if (surface === undefined && foreground === undefined && !lightInfluencesDark) continue
    if (surface?.kind === 'SIMPLE' && surface.value === 'transparent') continue
    const contrast = inspectBrandThemePair(theme, mode === '浅色' ? 'light' : 'dark', surfaceKey)
    if (contrast === null) continue
    if (contrast.ratio < 3) issues.push(`${mode}模式 ${surfaceKey}/${foregroundKey} 对比度低于 3:1`)
  }
}

/** Validate publish-time invariants that cannot be expressed by structural request schemas. */
export function validateBrandTheme(theme: BrandVisualTheme): string[] {
  const issues: string[] = []
  validateRamp('基础中性色阶', theme.customBasePalette, issues)
  validateRamp('品牌主色阶', theme.customPrimaryPalette, issues)
  validateMode(theme, '浅色', theme.overrides.light, issues)
  validateMode(theme, '深色', theme.overrides.dark, issues)
  return [...new Set(issues)]
}
