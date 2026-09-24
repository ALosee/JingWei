import { describe, expect, it } from 'vitest'

import { defaultBrandConfiguration } from '@jingwei/module-branding/shared'
import { registerBrandThemePalettes } from '@jingwei/module-branding/web'
import { generateThemePaletteColors, getThemePaletteColors } from '@jingwei/ui'

import { tenantThemeOptions } from './tenant-theme.js'

describe('tenant theme adapter', () => {
  it('maps the stable branding contract into the UI engine without user color overrides', () => {
    expect(
      tenantThemeOptions(
        {
          ...defaultBrandConfiguration.visualTheme,
          primaryPalette: 'rose',
          sidebarScheme: 'contrast',
        },
        'lg',
      ),
    ).toEqual({
      base: 'zinc',
      primary: 'rose',
      radius: 'md',
      sidebar: 'contrast',
      sidebarDerive: true,
      feedback: 'classic',
      chart: 'vivid',
      lightLevel: 0,
      darkLevel: 0,
      borderOpacity: 1,
      overrides: { light: {}, dark: {} },
      size: 'lg',
    })
  })

  it('resolves mode-specific references after explicitly registering tenant ramps', () => {
    const colors = generateThemePaletteColors('#7360c9')
    const visualTheme = {
      ...defaultBrandConfiguration.visualTheme,
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1' as const,
        name: '品牌紫',
        seedColor: '#7360c9',
        colors,
      },
      overrides: {
        light: {
          card: { kind: 'PALETTE' as const, palette: 'PRIMARY' as const, level: 100 as const },
        },
        dark: {
          card: { kind: 'PALETTE' as const, palette: 'PRIMARY' as const, level: 900 as const },
        },
      },
    }
    const options = tenantThemeOptions(visualTheme, 'md')

    expect(options.primary).toMatch(/^tenant-primary-/)
    if (!options.primary) throw new Error('Tenant primary palette key was not derived')
    registerBrandThemePalettes(visualTheme)
    expect(getThemePaletteColors(options.primary, 'primary')[100]).toEqual(colors[100])
    expect(options.overrides?.light?.card).toBe(`${options.primary}.100`)
    expect(options.overrides?.dark?.card).toBe(`${options.primary}.900`)
  })
})
