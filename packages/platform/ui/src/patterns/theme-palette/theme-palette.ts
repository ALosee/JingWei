import { colord, extend } from '@soybeanjs/colord'
import { generatePalette, paletteColorLevels, tailwindPalette } from '@soybeanjs/colord/palette'
import oklabPlugin from '@soybeanjs/colord/plugins/oklab'
import { isNeutralFamily } from '@vean/theme'
import type { PaletteLevel as PaletteColorLevel } from '@vean/theme'

export type ThemePaletteColors = Record<PaletteColorLevel, { hsl: string; oklch: string }>

export const themePaletteLevels = paletteColorLevels

extend([oklabPlugin])

/** Normalize a picked level to both color spaces used by the theme engine. */
export function normalizeThemePaletteColor(input: string): { hsl: string; oklch: string } {
  const color = colord(input)
  if (!color.isValid()) throw new Error('Invalid palette color')
  const opaque = color.alpha(1)
  return { hsl: opaque.toHslString(), oklch: opaque.toOklchString() }
}

/** Read colors from the built-in palette table for controlled palette selectors. */
export function getThemePaletteColors(
  key: string,
  target: 'base' | 'primary',
): Partial<ThemePaletteColors> {
  if (target === 'base' && !isNeutralFamily(key)) return {}
  if (key in tailwindPalette) return tailwindPalette[key as keyof typeof tailwindPalette]
  return {}
}

/** Generate the complete 50–950 color ramp persisted by tenant theme configuration. */
export function generateThemePaletteColors(seedColor: string): ThemePaletteColors {
  const hsl = generatePalette(seedColor, 'hslString')
  const oklch = generatePalette(seedColor, 'oklchString')
  return Object.fromEntries(
    paletteColorLevels.map((level) => [level, { hsl: hsl[level], oklch: oklch[level] }]),
  ) as ThemePaletteColors
}
