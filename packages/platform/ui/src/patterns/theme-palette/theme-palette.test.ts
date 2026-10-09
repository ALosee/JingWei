import { describe, expect, it } from 'vitest'

import {
  generateThemePaletteColors,
  getThemePaletteColors,
  normalizeThemePaletteColor,
  themePaletteLevels,
} from './theme-palette.js'

describe('tenant theme palettes', () => {
  it('generates every required color level while leaving built-in ramps unchanged', () => {
    const original = structuredClone(getThemePaletteColors('indigo', 'primary'))
    const colors = generateThemePaletteColors('#6366f1')
    expect(Object.keys(colors)).toHaveLength(themePaletteLevels.length)
    expect(getThemePaletteColors('indigo', 'primary')).toEqual(original)
    expect(getThemePaletteColors('unknown-palette', 'primary')).toEqual({})
  })

  it('normalizes individual edits to matching opaque HSL and OKLCH values', () => {
    const color = normalizeThemePaletteColor('#336699')
    expect(color.hsl).toMatch(/^hsl\(/)
    expect(color.oklch).toMatch(/^oklch\(/)
    expect(color.hsl).not.toContain('/')
  })
})
