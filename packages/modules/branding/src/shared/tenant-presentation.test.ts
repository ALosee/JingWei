import { describe, expect, it } from 'vitest'

import {
  brandConfigurationSchema,
  defaultBrandConfiguration,
  effectiveBrandSchema,
  defaultEffectiveBrand,
} from './index.js'

describe('tenant brand presentation contract', () => {
  it('includes safe visual and workspace defaults in the built-in brand', () => {
    expect(brandConfigurationSchema.parse(defaultBrandConfiguration)).toMatchObject({
      visualTheme: {
        schemaVersion: 2,
        basePalette: 'zinc',
        primaryPalette: 'indigo',
        lightLevel: 0,
        darkLevel: 0,
        radius: 'md',
        sidebarScheme: 'derived',
      },
      workspaceDefaults: {
        layoutMode: 'left',
        brandPlacement: 'header',
        headerHeight: 56,
        siderWidth: 220,
        showTabs: true,
      },
    })
    expect(effectiveBrandSchema.parse(defaultEffectiveBrand).schemaVersion).toBe(4)
  })

  it('rejects unsupported theme values and unsafe workspace dimensions', () => {
    expect(
      brandConfigurationSchema.safeParse({
        ...defaultBrandConfiguration,
        visualTheme: { ...defaultBrandConfiguration.visualTheme, primaryPalette: 'customer-css' },
      }).success,
    ).toBe(false)
    expect(
      brandConfigurationSchema.safeParse({
        ...defaultBrandConfiguration,
        workspaceDefaults: { ...defaultBrandConfiguration.workspaceDefaults, siderWidth: 1000 },
      }).success,
    ).toBe(false)
    expect(
      brandConfigurationSchema.safeParse({
        ...defaultBrandConfiguration,
        visualTheme: {
          ...defaultBrandConfiguration.visualTheme,
          overrides: {
            light: {
              card: { kind: 'LITERAL', value: 'url(https://example.com/tracker)' },
            },
            dark: {},
          },
        },
      }).success,
    ).toBe(false)
  })

  it('accepts sparse light and dark semantic overrides', () => {
    const parsed = brandConfigurationSchema.parse({
      ...defaultBrandConfiguration,
      visualTheme: {
        ...defaultBrandConfiguration.visualTheme,
        overrides: {
          light: {
            background: { kind: 'PALETTE', palette: 'BASE', level: 100 },
            card: { kind: 'SIMPLE', value: 'white' },
          },
          dark: {
            background: { kind: 'LITERAL', value: 'oklch(18% 0.02 260)' },
          },
        },
      },
    })
    expect(parsed.visualTheme.overrides.light.background).toEqual({
      kind: 'PALETTE',
      palette: 'BASE',
      level: 100,
    })
  })
})
