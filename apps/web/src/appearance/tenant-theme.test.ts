import { describe, expect, it } from 'vitest'

import { defaultBrandConfiguration } from '@jingwei/module-branding/shared'
import { generateThemePaletteColors } from '@jingwei/ui'

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
    ).toMatchObject({
      base: 'zinc',
      primary: 'rose',
      radius: '0.625rem',
      feedback: 'classic',
      borderOpacity: 1,
      size: 'lg',
      overrides: {
        light: { sidebar: 'zinc.800', 'sidebar-primary': 'white', 'chart-1': 'orange.600' },
        dark: { sidebar: 'zinc.900' },
      },
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

    expect(options.primary).toBe('indigo')
    expect(options.overrides?.light?.card).toBe(colors[100].hsl)
    expect(options.overrides?.dark?.card).toBe(colors[900].hsl)
  })
})
