import { describe, expect, it } from 'vitest'

import {
  brandConfigurationSchema,
  defaultBrandConfiguration,
  effectiveBrandSchema,
  defaultEffectiveBrand,
  workspaceLayoutModes,
  workspaceDefaultsSchema,
  workspaceSidebarVariants,
  supportsWorkspaceBrandPlacement,
  workspaceLogoPlacement,
} from './index.js'

describe('tenant brand presentation contract', () => {
  it.each(workspaceSidebarVariants)(
    'accepts the native %s sidebar with bottom branding',
    (sidebarVariant) => {
      expect(
        workspaceDefaultsSchema.parse({
          ...defaultBrandConfiguration.workspaceDefaults,
          sidebarVariant,
          brandPlacement: 'sider-bottom',
        }),
      ).toMatchObject({ sidebarVariant, brandPlacement: 'sider-bottom' })
    },
  )
  it('normalizes old workspace payloads without changing their brand placement', () => {
    expect(
      workspaceDefaultsSchema.parse({
        layoutMode: 'left',
        brandPlacement: 'header',
        headerHeight: 56,
        siderWidth: 220,
        showTabs: true,
      }),
    ).toMatchObject({ sidebarVariant: 'sidebar', brandPlacement: 'header' })
  })
  it('maps legacy storage names to native logo positions and constrains bottom choices', () => {
    expect(workspaceLogoPlacement('sider')).toBe('sidebar')
    expect(workspaceLogoPlacement('sider-bottom')).toBe('sidebar-bottom')
    expect(supportsWorkspaceBrandPlacement('left', 'sider-bottom')).toBe(true)
    expect(supportsWorkspaceBrandPlacement('dual-vertical', 'sider-bottom')).toBe(true)
    expect(supportsWorkspaceBrandPlacement('horizontal-vertical', 'sider-bottom')).toBe(false)
    expect(supportsWorkspaceBrandPlacement('top', 'sider')).toBe(false)
  })
  it.each(workspaceLayoutModes)(
    'accepts %s without changing historical presentation fields',
    (layoutMode) => {
      expect(
        brandConfigurationSchema.parse({
          ...defaultBrandConfiguration,
          workspaceDefaults: { ...defaultBrandConfiguration.workspaceDefaults, layoutMode },
        }).workspaceDefaults.layoutMode,
      ).toBe(layoutMode)
    },
  )
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
        brandPlacement: 'sider',
        sidebarVariant: 'sidebar',
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
