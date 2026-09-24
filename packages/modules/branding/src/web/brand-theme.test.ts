import { colord, extend } from '@soybeanjs/colord'
import a11yPlugin from '@soybeanjs/colord/plugins/a11y'
import { resolveTheme } from '@soybeanjs/theme'
import { createTheme } from '@soybeanjs/theme'
import { describe, expect, it } from 'vitest'

import { generateThemePaletteColors, getThemePaletteColors } from '@jingwei/ui/theme-palette'

import { inspectBrandThemePair, validateBrandTheme } from '../shared/brand-theme-validation.js'
import { defaultBrandConfiguration, type BrandVisualTheme } from '../shared/index.js'
import { brandThemeOptions, registerBrandThemePalettes } from './brand-theme.js'

extend([a11yPlugin])

function effectiveCssColor(css: string, mode: 'light' | 'dark', key: string): string {
  const root = [...css.matchAll(/:root \{([^}]*)\}/g)].at(-1)?.[1] ?? ''
  const dark = /\.dark \{([^}]*)\}/.exec(css)?.[1] ?? ''
  const variable = `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
  const declaration = new RegExp(`(?:^|\\n)\\s*${variable}:\\s*([^;]+);`)
  const value =
    (mode === 'dark' ? declaration.exec(dark)?.[1] : undefined) ?? declaration.exec(root)?.[1]
  if (value === undefined) throw new Error(`Theme CSS is missing ${variable}`)
  return `hsl(${value})`
}

function actualContrast(theme: BrandVisualTheme, surface: string, foreground: string): number {
  registerBrandThemePalettes(theme)
  const css = createTheme({
    ...brandThemeOptions(theme),
    styleTarget: ':root',
    darkSelector: '.dark',
    format: 'hsl',
  })
  return colord(effectiveCssColor(css, 'dark', surface)).contrast(
    effectiveCssColor(css, 'dark', foreground),
  )
}

describe('published brand theme adapter', () => {
  it('does not register a palette while deriving theme options', () => {
    const theme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: 'Pure options regression',
        seedColor: '#7c3aed',
        colors: generateThemePaletteColors('#7c3aed'),
      },
    }
    const options = brandThemeOptions(theme)
    expect(getThemePaletteColors(options.primary, 'primary')).toEqual({})

    registerBrandThemePalettes(theme)
    expect(getThemePaletteColors(options.primary, 'primary')[500]).toEqual(
      theme.customPrimaryPalette?.colors[500],
    )
  })

  it('keeps a tuned neutral primary in the neutral family', () => {
    const theme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      primaryPalette: 'zinc',
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '微调锌灰',
        seedColor: '#71717a',
        colors: generateThemePaletteColors('#71717a'),
      },
    }
    registerBrandThemePalettes(theme)
    const options = brandThemeOptions(theme)
    const resolved = resolveTheme(options)
    expect(resolved.light.primary).toBe(`${options.primary}.800`)
    expect(resolved.dark.primary).toBe(`${options.primary}.200`)
  })

  it('agrees with generated dark CSS when only light primary or card is changed', () => {
    const primaryTheme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      overrides: {
        light: { primary: { kind: 'PALETTE', palette: 'PRIMARY', level: 800 } },
        dark: {},
      },
    }
    const primaryContrast = actualContrast(primaryTheme, 'primary', 'primaryForeground')
    expect(primaryContrast).toBeLessThan(3)
    expect(inspectBrandThemePair(primaryTheme, 'dark', 'primary')?.ratio).toBeCloseTo(
      primaryContrast,
      2,
    )
    expect(validateBrandTheme(primaryTheme)).toContain(
      '深色模式 primary/primaryForeground 对比度低于 3:1',
    )

    const cardTheme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      overrides: {
        light: { card: { kind: 'PALETTE', palette: 'BASE', level: 500 } },
        dark: {},
      },
    }
    const cardContrast = actualContrast(cardTheme, 'card', 'cardForeground')
    expect(cardContrast).toBeLessThan(3)
    expect(inspectBrandThemePair(cardTheme, 'dark', 'card')?.ratio).toBeCloseTo(cardContrast, 2)
    expect(validateBrandTheme(cardTheme)).toContain('深色模式 card/cardForeground 对比度低于 3:1')
  })

  it('accepts an explicit readable dark primary, including a custom chromatic ramp', () => {
    const theme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '自定义品牌红',
        seedColor: '#cb3b4c',
        colors: generateThemePaletteColors('#cb3b4c'),
      },
      overrides: {
        light: { primary: { kind: 'PALETTE', palette: 'PRIMARY', level: 800 } },
        dark: { primary: { kind: 'PALETTE', palette: 'PRIMARY', level: 400 } },
      },
    }
    const contrast = actualContrast(theme, 'primary', 'primaryForeground')
    expect(contrast).toBeGreaterThanOrEqual(3)
    expect(inspectBrandThemePair(theme, 'dark', 'primary')?.ratio).toBeCloseTo(contrast, 2)
    expect(validateBrandTheme(theme)).not.toContain(
      '深色模式 primary/primaryForeground 对比度低于 3:1',
    )
  })

  it('distinguishes custom base and primary ramps even when both select the same built-in family', () => {
    const theme: BrandVisualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      primaryPalette: 'zinc',
      customBasePalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '冷灰',
        seedColor: '#75839a',
        colors: generateThemePaletteColors('#75839a'),
      },
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '暖红',
        seedColor: '#b44f6a',
        colors: generateThemePaletteColors('#b44f6a'),
      },
      overrides: {
        light: { card: { kind: 'PALETTE', palette: 'PRIMARY', level: 500 } },
        dark: {},
      },
    }
    const contrast = actualContrast(theme, 'card', 'cardForeground')
    expect(inspectBrandThemePair(theme, 'dark', 'card')?.ratio).toBeCloseTo(contrast, 2)
    expect(validateBrandTheme(theme).includes('深色模式 card/cardForeground 对比度低于 3:1')).toBe(
      contrast < 3,
    )
  })
})
