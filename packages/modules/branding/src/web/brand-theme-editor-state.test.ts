import { tailwindPalette } from '@soybeanjs/colord/palette'
import { describe, expect, it } from 'vitest'

import { brandVisualThemeSchema, defaultBrandConfiguration } from '../shared/index.js'
import {
  cloneCurrentBrandPalette,
  regenerateBrandPalette,
  selectBrandThemeLevel,
  updateBrandPaletteLevel,
} from './brand-theme-editor-state.js'

const theme = defaultBrandConfiguration.visualTheme

describe('brand theme editor state', () => {
  it('starts a tuned palette from every exact shade of the selected preset', () => {
    const palette = cloneCurrentBrandPalette(theme, 'base')
    expect(palette.colors[50]).toEqual({
      hsl: tailwindPalette.zinc[50].hsl,
      oklch: tailwindPalette.zinc[50].oklch,
    })
    expect(palette.colors[500].hsl).toBe(tailwindPalette.zinc[500].hsl)
    expect(brandVisualThemeSchema.safeParse({ ...theme, customBasePalette: palette }).success).toBe(
      true,
    )
  })

  it('changes only the chosen shade and regenerates the whole ramp only on an explicit action', () => {
    const palette = cloneCurrentBrandPalette(theme, 'primary')
    const changed = updateBrandPaletteLevel(palette, 600, '#4756ba')
    expect(changed.colors[600]).not.toEqual(palette.colors[600])
    expect(changed.colors[500]).toEqual(palette.colors[500])
    expect(changed.seedColor).toBe(palette.seedColor)

    const regenerated = regenerateBrandPalette(changed, '#8b5cf6')
    expect(regenerated.seedColor).toBe('#8b5cf6')
    expect(regenerated.colors[500]).not.toEqual(changed.colors[500])
  })

  it('selects a semantic shade without changing either foundation palette', () => {
    const next = selectBrandThemeLevel(theme, 'light', 'primary', 'PRIMARY', 600)
    expect(next.overrides.light.primary).toEqual({
      kind: 'PALETTE',
      palette: 'PRIMARY',
      level: 600,
    })
    expect(next.primaryPalette).toBe(theme.primaryPalette)
    expect(next.customPrimaryPalette).toBeNull()
    expect(next.overrides.dark).toEqual({})
  })
})
