import { generatePalette, paletteColorLevels, tailwindPalette } from '@soybeanjs/colord/palette'
import { describe, expect, it } from 'vitest'

import { validateBrandTheme } from './brand-theme-validation.js'
import { defaultBrandConfiguration } from './index.js'

describe('tenant brand theme validation', () => {
  it('accepts the derived platform theme', () => {
    expect(validateBrandTheme(defaultBrandConfiguration.visualTheme)).toEqual([])
  })

  it('accepts a generated tenant ramp', () => {
    const hsl = generatePalette('#75839a', 'hslString')
    const oklch = generatePalette('#75839a', 'oklchString')
    const colors = Object.fromEntries(
      paletteColorLevels.map((level) => [level, { hsl: hsl[level], oklch: oklch[level] }]),
    ) as typeof tailwindPalette.indigo
    expect(
      validateBrandTheme({
        ...defaultBrandConfiguration.visualTheme,
        customBasePalette: {
          profile: 'OKLCH_PALETTE_V1',
          name: 'Customer neutral',
          seedColor: '#75839a',
          colors,
        },
      }),
    ).toEqual([])
  })

  it('rejects explicitly configured text and surface colors with unusable contrast', () => {
    expect(
      validateBrandTheme({
        ...defaultBrandConfiguration.visualTheme,
        overrides: {
          ...defaultBrandConfiguration.visualTheme.overrides,
          light: {
            background: { kind: 'SIMPLE', value: 'black' },
            foreground: { kind: 'SIMPLE', value: 'black' },
          },
        },
      }),
    ).toContain('浅色模式 background/foreground 对比度低于 3:1')
  })

  it('checks an overridden surface against its inherited foreground', () => {
    expect(
      validateBrandTheme({
        ...defaultBrandConfiguration.visualTheme,
        overrides: {
          light: { card: { kind: 'SIMPLE', value: 'black' } },
          dark: {},
        },
      }),
    ).toContain('浅色模式 card/cardForeground 对比度低于 3:1')
  })

  it('rejects a light primary shade whose derived dark color loses contrast', () => {
    const theme = {
      ...defaultBrandConfiguration.visualTheme,
      overrides: {
        light: {
          primary: { kind: 'PALETTE' as const, palette: 'PRIMARY' as const, level: 800 as const },
        },
        dark: {},
      },
    }
    expect(validateBrandTheme(theme)).toContain('深色模式 primary/primaryForeground 对比度低于 3:1')
    expect(
      validateBrandTheme({
        ...theme,
        overrides: {
          ...theme.overrides,
          dark: { primary: { kind: 'PALETTE', palette: 'PRIMARY', level: 500 } },
        },
      }),
    ).not.toContain('深色模式 primary/primaryForeground 对比度低于 3:1')
  })

  it('checks the derived dark card even when only the light card was overridden', () => {
    expect(
      validateBrandTheme({
        ...defaultBrandConfiguration.visualTheme,
        overrides: {
          light: { card: { kind: 'PALETTE', palette: 'BASE', level: 500 } },
          dark: {},
        },
      }),
    ).toContain('深色模式 card/cardForeground 对比度低于 3:1')
  })

  it('rejects a custom ramp whose two stored color formats disagree', () => {
    const colors = structuredClone(tailwindPalette.indigo)
    colors[500].oklch = 'oklch(100% 0 0)'
    const issues = validateBrandTheme({
      ...defaultBrandConfiguration.visualTheme,
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: 'Customer indigo',
        seedColor: '#6366f1',
        colors,
      },
    })
    expect(issues).toContain('品牌主色阶 500 的 HSL 与 OKLCH 不一致')
  })
})
