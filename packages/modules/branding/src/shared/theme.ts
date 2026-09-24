import { z } from 'zod'

export const brandBasePalettes = [
  'slate',
  'mist',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'taupe',
  'olive',
  'mauve',
] as const
export const brandPrimaryPalettes = [
  ...brandBasePalettes,
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const
export const brandPaletteLevels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export const brandRadiusOptions = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
export const brandSidebarSchemes = ['derived', 'inverted-dark', 'soft', 'contrast'] as const
export const brandFeedbackSchemes = [
  'classic',
  'vivid',
  'subtle',
  'modern',
  'professional',
] as const
export const brandChartSchemes = ['vivid', 'cool', 'warm', 'natural', 'minimal'] as const
export const brandThemeModes = ['light', 'dark'] as const

export const brandSemanticTokenKeys = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'popoverForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebarForeground',
  'sidebarPrimary',
  'sidebarPrimaryForeground',
  'sidebarAccent',
  'sidebarAccentForeground',
  'sidebarBorder',
  'sidebarRing',
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
  'success',
  'successForeground',
  'warning',
  'warningForeground',
  'info',
  'infoForeground',
  'carbon',
  'carbonForeground',
] as const

const safeHsl = z
  .string()
  .max(80)
  .regex(/^hsl\([\d.+-]+(?:deg)?\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*(?:[\d.]+%?))?\)$/)
const safeOklch = z
  .string()
  .max(80)
  .regex(/^oklch\([\d.]+%?\s+[\d.]+\s+[\d.+-]+(?:deg)?(?:\s*\/\s*(?:[\d.]+%?))?\)$/)
const safeHex = z.string().regex(/^#[\da-f]{6}$/i)

const paletteColorSchema = z
  .object({
    hsl: safeHsl,
    oklch: safeOklch,
  })
  .strict()

export const brandCustomPaletteSchema = z
  .object({
    profile: z.literal('OKLCH_PALETTE_V1'),
    name: z.string().trim().min(1).max(40),
    seedColor: z.union([safeHex, safeHsl, safeOklch]),
    colors: z
      .object({
        50: paletteColorSchema,
        100: paletteColorSchema,
        200: paletteColorSchema,
        300: paletteColorSchema,
        400: paletteColorSchema,
        500: paletteColorSchema,
        600: paletteColorSchema,
        700: paletteColorSchema,
        800: paletteColorSchema,
        900: paletteColorSchema,
        950: paletteColorSchema,
      })
      .strict(),
  })
  .strict()

const paletteReferenceKeys = ['BASE', 'PRIMARY', ...brandPrimaryPalettes] as const
const paletteLevelSchema = z.union(brandPaletteLevels.map((level) => z.literal(level)))

export const brandThemeColorSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('PALETTE'),
        palette: z.enum(paletteReferenceKeys),
        level: paletteLevelSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('SIMPLE'),
        value: z.enum(['transparent', 'black', 'white']),
      })
      .strict(),
    z
      .object({
        kind: z.literal('LITERAL'),
        value: z.union([safeHsl, safeOklch]),
      })
      .strict(),
  ])
  .meta({ id: 'BrandThemeColor' })

export const brandSemanticOverridesSchema = z.partialRecord(
  z.enum(brandSemanticTokenKeys),
  brandThemeColorSchema,
)

export const brandVisualThemeSchema = z
  .object({
    schemaVersion: z.literal(2),
    basePalette: z.enum(brandBasePalettes),
    primaryPalette: z.enum(brandPrimaryPalettes),
    customBasePalette: brandCustomPaletteSchema.nullable(),
    customPrimaryPalette: brandCustomPaletteSchema.nullable(),
    radius: z.enum(brandRadiusOptions),
    sidebarScheme: z.enum(brandSidebarSchemes),
    feedbackScheme: z.enum(brandFeedbackSchemes),
    chartScheme: z.enum(brandChartSchemes),
    lightLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    darkLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    borderOpacity: z.number().min(0).max(1),
    overrides: z
      .object({
        light: brandSemanticOverridesSchema,
        dark: brandSemanticOverridesSchema,
      })
      .strict(),
  })
  .strict()
  .meta({ id: 'BrandVisualTheme' })

export function serializeBrandThemeColor(
  color: BrandThemeColor,
  basePalette: string,
  primaryPalette: string,
): string {
  if (color.kind === 'SIMPLE' || color.kind === 'LITERAL') return color.value
  const palette =
    color.palette === 'BASE'
      ? basePalette
      : color.palette === 'PRIMARY'
        ? primaryPalette
        : color.palette
  return `${palette}.${color.level}`
}

export type BrandBasePalette = (typeof brandBasePalettes)[number]
export type BrandPrimaryPalette = (typeof brandPrimaryPalettes)[number]
export type BrandPaletteLevel = (typeof brandPaletteLevels)[number]
export type BrandRadius = (typeof brandRadiusOptions)[number]
export type BrandSidebarScheme = (typeof brandSidebarSchemes)[number]
export type BrandFeedbackScheme = (typeof brandFeedbackSchemes)[number]
export type BrandChartScheme = (typeof brandChartSchemes)[number]
export type BrandSemanticTokenKey = (typeof brandSemanticTokenKeys)[number]
export type BrandCustomPalette = z.infer<typeof brandCustomPaletteSchema>
export type BrandThemeColor = z.infer<typeof brandThemeColorSchema>
export type BrandSemanticOverrides = z.infer<typeof brandSemanticOverridesSchema>
export type BrandVisualTheme = z.infer<typeof brandVisualThemeSchema>
