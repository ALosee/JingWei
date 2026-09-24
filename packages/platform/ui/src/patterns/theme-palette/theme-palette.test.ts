import { getRegistry } from '@soybeanjs/theme'
import { describe, expect, it } from 'vitest'

import {
  createThemePaletteSlot,
  generateThemePaletteColors,
  getThemePaletteColors,
  normalizeThemePaletteColor,
  registerThemePalette,
  themePaletteKey,
  themePaletteLevels,
} from './theme-palette.js'

describe('tenant theme palettes', () => {
  it('generates and registers every required color level under a stable key', () => {
    const colors = generateThemePaletteColors('#6366f1')
    expect(Object.keys(colors)).toHaveLength(themePaletteLevels.length)
    const palette = { name: 'Customer indigo', family: 'chromatic' as const, colors }
    const key = registerThemePalette(palette, 'primary')
    expect(registerThemePalette(palette, 'primary')).toBe(key)
    expect(getThemePaletteColors(key, 'primary')[500]).toEqual(colors[500])
  })

  it('normalizes individual edits to matching opaque HSL and OKLCH values', () => {
    const color = normalizeThemePaletteColor('#336699')
    expect(color.hsl).toMatch(/^hsl\(/)
    expect(color.oklch).toMatch(/^oklch\(/)
    expect(color.hsl).not.toContain('/')
  })

  it('reuses one preview key while colors change and releases it on disposal', () => {
    const first = {
      name: 'Preview first',
      family: 'chromatic' as const,
      colors: generateThemePaletteColors('#6366f1'),
    }
    const second = {
      name: 'Preview second',
      family: 'chromatic' as const,
      colors: generateThemePaletteColors('#dc2626'),
    }
    const key = themePaletteKey(first, 'primary')
    expect(getRegistry().primary[key]).toBeUndefined()

    const slot = createThemePaletteSlot('primary')
    slot.update(first)
    expect(getThemePaletteColors(slot.key, 'primary')[500]).toEqual(first.colors[500])
    const count = Object.keys(getRegistry().primary).length
    slot.update(second)
    expect(slot.key).not.toBe(key)
    expect(getThemePaletteColors(slot.key, 'primary')[500]).toEqual(second.colors[500])
    expect(Object.keys(getRegistry().primary)).toHaveLength(count)

    slot.dispose()
    expect(getRegistry().primary[slot.key]).toBeUndefined()
    slot.dispose()
  })
})
