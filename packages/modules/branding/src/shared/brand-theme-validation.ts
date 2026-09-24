import { colord, extend } from '@soybeanjs/colord'
import { tailwindPalette } from '@soybeanjs/colord/palette'
import a11yPlugin from '@soybeanjs/colord/plugins/a11y'
import oklabPlugin from '@soybeanjs/colord/plugins/oklab'
import { resolveTheme } from '@soybeanjs/theme'
import type { ColorTokens } from '@soybeanjs/theme'

import type {
  BrandCustomPalette,
  BrandSemanticOverrides,
  BrandThemeColor,
  BrandVisualTheme,
} from './theme.js'
import { serializeBrandThemeColor } from './theme.js'

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

type PaletteReference = Extract<BrandThemeColor, { kind: 'PALETTE' }>['palette']
type PaletteLevel = keyof BrandCustomPalette['colors']

function paletteColorAt(
  theme: BrandVisualTheme,
  palette: PaletteReference,
  level: PaletteLevel,
): string {
  if (palette === 'BASE')
    return (
      theme.customBasePalette?.colors[level].hsl ?? tailwindPalette[theme.basePalette][level].hsl
    )
  if (palette === 'PRIMARY')
    return (
      theme.customPrimaryPalette?.colors[level].hsl ??
      tailwindPalette[theme.primaryPalette][level].hsl
    )
  return tailwindPalette[palette][level].hsl
}

function cssColor(theme: BrandVisualTheme, value: BrandThemeColor): string {
  if (value.kind === 'PALETTE') return paletteColorAt(theme, value.palette, value.level)
  if (value.kind === 'SIMPLE') {
    if (value.value === 'white') return '#ffffff'
    if (value.value === 'black') return '#000000'
    return 'rgba(0, 0, 0, 0)'
  }
  return value.value
}

const primaryDerivedKeys = new Set(['primary', 'ring', 'sidebarPrimary', 'sidebarRing'])

function resolvedColor(
  theme: BrandVisualTheme,
  key: string,
  value: string,
  lightSource?: BrandThemeColor,
): string {
  if (value === 'white') return '#ffffff'
  if (value === 'black') return '#000000'
  const match = /^([a-z][a-z-]*)\.(50|100|200|300|400|500|600|700|800|900|950)$/.exec(value)
  if (match === null) return value
  const palette = match[1]
  const level = Number(match[2]) as PaletteLevel
  if (lightSource?.kind === 'PALETTE') {
    const sourcePalette =
      lightSource.palette === 'BASE'
        ? theme.basePalette
        : lightSource.palette === 'PRIMARY'
          ? theme.primaryPalette
          : lightSource.palette
    if (palette === sourcePalette) return paletteColorAt(theme, lightSource.palette, level)
  }
  if (primaryDerivedKeys.has(key) && palette === theme.primaryPalette)
    return (
      theme.customPrimaryPalette?.colors[level].hsl ??
      tailwindPalette[theme.primaryPalette][level].hsl
    )
  if (palette === theme.basePalette)
    return (
      theme.customBasePalette?.colors[level].hsl ?? tailwindPalette[theme.basePalette][level].hsl
    )
  if (palette !== undefined && palette in tailwindPalette)
    return tailwindPalette[palette as keyof typeof tailwindPalette][level].hsl
  return value
}

function serializedOverrides(
  theme: BrandVisualTheme,
  overrides: BrandSemanticOverrides,
): Partial<ColorTokens> {
  return Object.fromEntries(
    Object.entries(overrides).map(([key, color]) => [
      key,
      serializeBrandThemeColor(color, theme.basePalette, theme.primaryPalette),
    ]),
  )
}

function resolveBrandTheme(theme: BrandVisualTheme): ReturnType<typeof resolveTheme> {
  return resolveTheme({
    base: theme.basePalette,
    primary: theme.primaryPalette,
    sidebar: theme.sidebarScheme,
    sidebarDerive: true,
    feedback: theme.feedbackScheme,
    chart: theme.chartScheme,
    lightLevel: theme.lightLevel,
    darkLevel: theme.darkLevel,
    overrides: {
      light: serializedOverrides(theme, theme.overrides.light),
      dark: serializedOverrides(theme, theme.overrides.dark),
    },
  })
}

function inspectResolvedPair(
  theme: BrandVisualTheme,
  mode: 'light' | 'dark',
  overrides: BrandSemanticOverrides,
  resolved: ColorTokens,
  surfaceKey: BrandThemeContrastSurface,
  foregroundKey: (typeof contrastPairs)[number][1],
): BrandThemeContrast | null {
  const surface = overrides[surfaceKey]
  if (surface?.kind === 'SIMPLE' && surface.value === 'transparent') return null
  const defaultSurface = resolved[surfaceKey]
  const defaultForeground = resolved[foregroundKey]
  if (defaultSurface === undefined || defaultForeground === undefined) return null
  const foreground = overrides[foregroundKey]
  const surfaceColor =
    surface === undefined
      ? resolvedColor(
          theme,
          surfaceKey,
          defaultSurface,
          mode === 'dark' ? theme.overrides.light[surfaceKey] : undefined,
        )
      : cssColor(theme, surface)
  const foregroundColor =
    foreground === undefined
      ? resolvedColor(
          theme,
          foregroundKey,
          defaultForeground,
          mode === 'dark' ? theme.overrides.light[foregroundKey] : undefined,
        )
      : cssColor(theme, foreground)
  return {
    surfaceColor,
    foregroundColor,
    ratio: colord(surfaceColor).contrast(foregroundColor),
  }
}

/** Inspect the same effective pair used by publication checks, including CSS dark inheritance. */
export function inspectBrandThemePair(
  theme: BrandVisualTheme,
  mode: 'light' | 'dark',
  surfaceKey: BrandThemeContrastSurface,
): BrandThemeContrast | null {
  const pair = contrastPairs.find(([key]) => key === surfaceKey)
  if (pair === undefined) return null
  const resolved = resolveBrandTheme(theme)
  return inspectResolvedPair(
    theme,
    mode,
    theme.overrides[mode],
    mode === 'light' ? resolved.light : { ...resolved.light, ...resolved.dark },
    pair[0],
    pair[1],
  )
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
  resolved: ColorTokens,
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
    const contrast = inspectResolvedPair(
      theme,
      mode === '深色' ? 'dark' : 'light',
      overrides,
      resolved,
      surfaceKey,
      foregroundKey,
    )
    if (contrast === null) {
      issues.push(`${mode}模式 ${surfaceKey}/${foregroundKey} 缺少有效默认颜色`)
      continue
    }
    if (contrast.ratio < 3) issues.push(`${mode}模式 ${surfaceKey}/${foregroundKey} 对比度低于 3:1`)
  }
}

/** Validate publish-time invariants that cannot be expressed by structural request schemas. */
export function validateBrandTheme(theme: BrandVisualTheme): string[] {
  const issues: string[] = []
  validateRamp('基础中性色阶', theme.customBasePalette, issues)
  validateRamp('品牌主色阶', theme.customPrimaryPalette, issues)
  const resolved = resolveBrandTheme(theme)
  validateMode(theme, '浅色', theme.overrides.light, resolved.light, issues)
  validateMode(theme, '深色', theme.overrides.dark, { ...resolved.light, ...resolved.dark }, issues)
  return [...new Set(issues)]
}
