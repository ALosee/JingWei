import { tailwindPalette } from '@soybeanjs/colord/palette'

import { generateThemePaletteColors, normalizeThemePaletteColor } from '@jingwei/ui/theme-palette'

import {
  type BrandCustomPalette,
  type BrandPaletteLevel,
  type BrandSemanticTokenKey,
  type BrandVisualTheme,
} from '../shared/index.js'

type PaletteTarget = 'base' | 'primary'
type ThemeMode = 'light' | 'dark'

/** Enter tuning with an exact copy: the first edit must not visually change the preset. */
export function cloneCurrentBrandPalette(
  theme: BrandVisualTheme,
  target: PaletteTarget,
): BrandCustomPalette {
  const selected = target === 'base' ? theme.basePalette : theme.primaryPalette
  const builtIn = tailwindPalette[selected]
  return {
    profile: 'OKLCH_PALETTE_V1',
    name: target === 'base' ? '已微调的中性色' : '已微调的品牌色',
    seedColor: builtIn[500].hsl,
    colors: {
      50: { hsl: builtIn[50].hsl, oklch: builtIn[50].oklch },
      100: { hsl: builtIn[100].hsl, oklch: builtIn[100].oklch },
      200: { hsl: builtIn[200].hsl, oklch: builtIn[200].oklch },
      300: { hsl: builtIn[300].hsl, oklch: builtIn[300].oklch },
      400: { hsl: builtIn[400].hsl, oklch: builtIn[400].oklch },
      500: { hsl: builtIn[500].hsl, oklch: builtIn[500].oklch },
      600: { hsl: builtIn[600].hsl, oklch: builtIn[600].oklch },
      700: { hsl: builtIn[700].hsl, oklch: builtIn[700].oklch },
      800: { hsl: builtIn[800].hsl, oklch: builtIn[800].oklch },
      900: { hsl: builtIn[900].hsl, oklch: builtIn[900].oklch },
      950: { hsl: builtIn[950].hsl, oklch: builtIn[950].oklch },
    },
  }
}

export function updateBrandPaletteLevel(
  palette: BrandCustomPalette,
  level: BrandPaletteLevel,
  color: string,
): BrandCustomPalette {
  return {
    ...palette,
    colors: { ...palette.colors, [level]: normalizeThemePaletteColor(color) },
  }
}

/** This is intentionally separate from shade selection and single-shade editing. */
export function regenerateBrandPalette(
  palette: BrandCustomPalette,
  seedColor: string,
): BrandCustomPalette {
  return { ...palette, seedColor, colors: generateThemePaletteColors(seedColor) }
}

export function selectBrandThemeLevel(
  theme: BrandVisualTheme,
  mode: ThemeMode,
  token: BrandSemanticTokenKey,
  palette: 'BASE' | 'PRIMARY',
  level: BrandPaletteLevel,
): BrandVisualTheme {
  return {
    ...theme,
    overrides: {
      ...theme.overrides,
      [mode]: {
        ...theme.overrides[mode],
        [token]: { kind: 'PALETTE', palette, level },
      },
    },
  }
}
