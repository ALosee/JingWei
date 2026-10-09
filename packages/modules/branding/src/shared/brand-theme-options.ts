import { colord } from '@soybeanjs/colord'
import { tailwindPalette } from '@soybeanjs/colord/palette'
import { isSemanticToken, resolveThemeMap, valueRef } from '@vean/theme'
import type {
  ColorValue,
  PaletteLevel,
  SemanticToken,
  ThemeOptions,
  TokenOverride,
} from '@vean/theme'

import { brandBasePalettes } from './theme.js'
import type { BrandThemeColor, BrandVisualTheme } from './theme.js'

type Overrides = Partial<Record<SemanticToken, TokenOverride>>
type Mode = 'light' | 'dark'

// V2 tenant configuration retains the palette, chart and sidebar choices published before Vean.
// Scheme values follow SoybeanUI v0.30.0 (MIT); the resulting overrides use Vean's native API.
const chartSchemes = {
  vivid: [
    ['orange.600', 'teal.600', 'cyan.900', 'amber.400', 'amber.500'],
    ['blue.700', 'emerald.500', 'amber.500', 'purple.500', 'rose.500'],
  ],
  cool: [
    ['blue.700', 'cyan.600', 'sky.500', 'indigo.500', 'violet.500'],
    ['sky.300', 'cyan.300', 'blue.300', 'indigo.300', 'violet.300'],
  ],
  warm: [
    ['orange.600', 'amber.500', 'rose.500', 'red.600', 'orange.400'],
    ['orange.300', 'amber.300', 'rose.300', 'red.300', 'orange.200'],
  ],
  natural: [
    ['green.600', 'emerald.500', 'teal.600', 'lime.500', 'cyan.600'],
    ['green.300', 'emerald.300', 'teal.300', 'lime.300', 'cyan.300'],
  ],
  minimal: [
    ['slate.500', 'blue.400', 'emerald.400', 'amber.400', 'rose.400'],
    ['slate.300', 'blue.300', 'emerald.300', 'amber.300', 'rose.300'],
  ],
} as const

const tenantRadius = {
  '2xs': '0.25rem',
  xs: '0.375rem',
  sm: '0.5rem',
  md: '0.625rem',
  lg: '0.75rem',
  xl: '0.875rem',
  '2xl': '1rem',
} as const

export function brandThemeToken(key: string): SemanticToken {
  const token = key
    .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    .replace(/^chart(\d)$/, 'chart-$1')
  if (!isSemanticToken(token)) throw new Error(`Unsupported brand theme token: ${key}`)
  return token
}

function paletteColor(
  theme: BrandVisualTheme,
  target: 'base' | 'primary',
  level: PaletteLevel,
): ColorValue {
  const custom = target === 'base' ? theme.customBasePalette : theme.customPrimaryPalette
  const palette = target === 'base' ? theme.basePalette : theme.primaryPalette
  return custom === null ? `${palette}.${level}` : (custom.colors[level].hsl as ColorValue)
}

function literalColor(theme: BrandVisualTheme, color: BrandThemeColor): ColorValue {
  if (color.kind !== 'PALETTE') return color.value as ColorValue
  if (color.palette === 'BASE') return paletteColor(theme, 'base', color.level)
  if (color.palette === 'PRIMARY') return paletteColor(theme, 'primary', color.level)
  return `${color.palette}.${color.level}`
}

function darkColor(
  theme: BrandVisualTheme,
  token: SemanticToken,
  color: BrandThemeColor,
): ColorValue {
  if (token === 'border' || token === 'sidebar-border') return 'oklch(100% 0 0 / 0.1)'
  if (token === 'input') return 'oklch(100% 0 0 / 0.15)'
  if (color.kind === 'SIMPLE' && color.value === 'white') {
    return paletteColor(theme, 'base', ['card', 'popover', 'sidebar'].includes(token) ? 900 : 950)
  }
  if (color.kind !== 'PALETTE') return literalColor(theme, color)
  const palette =
    color.palette === 'BASE'
      ? theme.basePalette
      : color.palette === 'PRIMARY'
        ? theme.primaryPalette
        : color.palette
  const neutral = brandBasePalettes.some((key) => key === palette)
  let level = color.level
  if (token === 'primary' || token === 'ring') {
    if (token === 'primary' && neutral && level === 800) level = 200
    else if (token === 'primary' && !neutral && (level === 500 || level === 600))
      level = ['lime', 'green', 'emerald'].includes(palette) ? 600 : 500
    else if (token === 'ring' && level === 400) level = neutral ? 500 : 900
  } else {
    const flips: Partial<Record<PaletteLevel, PaletteLevel>> = {
      50: 900,
      100: 800,
      500: 400,
      800: 100,
      900: 50,
      950: 50,
    }
    level = flips[level] ?? level
  }
  return literalColor(theme, { ...color, level })
}

function baseOverrides(theme: BrandVisualTheme, mode: Mode): Overrides {
  const light = mode === 'light'
  const offset = light ? theme.lightLevel : theme.darkLevel
  const surface = light ? ([null, 50, 100] as const) : ([950, 900, 800, 700] as const)
  const card = light ? surface : ([900, 800, 700, 600] as const)
  const weak = light ? ([100, 200, 300] as const) : ([800, 700, 600, 500] as const)
  const muted = light ? ([500, 600, 700] as const) : ([400, 300, 200, 100] as const)
  const color = (level: PaletteLevel | null | undefined) =>
    level == null ? 'white' : paletteColor(theme, 'base', level)
  const foreground = color(light ? 950 : 50)
  const onPrimary = color(light ? 50 : 900)
  return {
    background: color(surface[offset]),
    foreground,
    card: color(card[offset]),
    'card-foreground': foreground,
    popover: color(card[offset]),
    'popover-foreground': foreground,
    muted: color(weak[offset]),
    'muted-foreground': color(muted[offset]),
    secondary: color(weak[offset]),
    'secondary-foreground': color(light ? 900 : 50),
    accent: color(weak[offset]),
    'accent-foreground': color(light ? 900 : 50),
    'primary-foreground': onPrimary,
    'destructive-foreground': onPrimary,
    'success-foreground': onPrimary,
    'warning-foreground': onPrimary,
    'info-foreground': onPrimary,
    carbon: color(light ? 800 : 100),
    'carbon-foreground': color(light ? 50 : 950),
    border: light ? color(200) : 'oklch(100% 0 0 / 0.1)',
    input: light ? color(200) : 'oklch(100% 0 0 / 0.15)',
  }
}

function sidebarOverrides(
  theme: BrandVisualTheme,
  mode: Mode,
  source: Record<SemanticToken, TokenOverride>,
): Overrides {
  const dark = mode === 'dark'
  const inverse =
    theme.sidebarScheme === 'inverted-dark' || (theme.sidebarScheme === 'contrast' && !dark)
  const contrast = theme.sidebarScheme === 'contrast' && !dark
  const soft = theme.sidebarScheme === 'soft'
  return {
    sidebar: inverse
      ? 'zinc.800'
      : source[soft ? (dark ? 'muted' : 'secondary') : dark ? 'card' : 'background'],
    'sidebar-foreground': inverse
      ? 'zinc.100'
      : source[soft && !dark ? 'secondary-foreground' : 'foreground'],
    'sidebar-primary': source[contrast ? 'background' : 'primary'],
    'sidebar-primary-foreground': source[contrast ? 'foreground' : 'primary-foreground'],
    'sidebar-accent': contrast ? source.primary : inverse ? 'zinc.700' : source.accent,
    'sidebar-accent-foreground': contrast
      ? source['primary-foreground']
      : inverse
        ? 'zinc.100'
        : source['accent-foreground'],
    'sidebar-border': inverse ? (dark ? 'zinc.600' : 'zinc.700') : source.border,
    'sidebar-ring': source.ring,
  }
}

/** Pure adapter shared by publication validation, draft preview and the application Provider. */
export function resolveBrandThemeOptions(
  theme: BrandVisualTheme,
  size?: ThemeOptions['size'],
): ThemeOptions & { primaryRamp?: Record<PaletteLevel, ColorValue> } {
  const options: ThemeOptions = {
    base: theme.basePalette,
    primary: theme.primaryPalette,
    feedback: theme.feedbackScheme,
    radius: tenantRadius[theme.radius],
    borderOpacity: theme.borderOpacity,
    ...(size === undefined ? {} : { size }),
  }
  const nominal = resolveThemeMap(options)
  const overrides: { light: Overrides; dark: Overrides } = { light: {}, dark: {} }
  for (const mode of ['light', 'dark'] as const) {
    const source = Object.fromEntries(
      Object.entries(nominal[mode]).map(([key, value]) => [key, valueRef(value)]),
    ) as Record<SemanticToken, TokenOverride>
    Object.assign(source, baseOverrides(theme, mode))
    const neutral = brandBasePalettes.some((key) => key === theme.primaryPalette)
    source.primary = paletteColor(
      theme,
      'primary',
      neutral
        ? mode === 'light'
          ? 800
          : 200
        : mode === 'light'
          ? 500
          : ['lime', 'green', 'emerald'].includes(theme.primaryPalette)
            ? 600
            : 500,
    )
    source.ring = paletteColor(
      theme,
      'primary',
      neutral ? (mode === 'light' ? 400 : 500) : mode === 'light' ? 400 : 900,
    )
    chartSchemes[theme.chartScheme][mode === 'light' ? 0 : 1].forEach((color, index) => {
      source[brandThemeToken(`chart${index + 1}`)] = color
    })
    Object.assign(source, sidebarOverrides(theme, mode, source))
    if (mode === 'dark') {
      for (const [key, color] of Object.entries(theme.overrides.light))
        source[brandThemeToken(key)] = darkColor(theme, brandThemeToken(key), color)
    }
    for (const [key, color] of Object.entries(theme.overrides[mode]))
      source[brandThemeToken(key)] = literalColor(theme, color)
    overrides[mode] = source
  }
  return {
    ...options,
    overrides,
    ...(theme.customPrimaryPalette === null
      ? {}
      : {
          primaryRamp: Object.fromEntries(
            Object.entries(theme.customPrimaryPalette.colors).map(([level, color]) => [
              level,
              color.hsl,
            ]),
          ) as Record<PaletteLevel, ColorValue>,
        }),
  }
}

/** Complete colors from the same engine options sent to the browser (including custom ramps). */
export function resolveBrandThemeColor(theme: BrandVisualTheme, mode: Mode, key: string): string {
  const options = resolveBrandThemeOptions(theme)
  const name = brandThemeToken(key)
  const value = options.overrides?.[mode]?.[name]
  if (value === 'transparent') return 'rgba(0, 0, 0, 0)'
  const override = colord(value ?? '')
  if (override.isValid() && override.alpha() === 0) return 'rgba(0, 0, 0, 0)'
  const token = resolveThemeMap(options)[mode][name]
  if (token.kind === 'palette') return tailwindPalette[token.palette][token.level].hsl
  if (token.kind === 'simple') return token.name === 'white' ? '#ffffff' : '#000000'
  return colord(token.value).toHslString()
}
