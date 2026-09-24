import { colord, extend } from '@soybeanjs/colord'
import { generatePalette, paletteColorLevels } from '@soybeanjs/colord/palette'
import oklabPlugin from '@soybeanjs/colord/plugins/oklab'
import { getRegistry, registerThemePresets } from '@soybeanjs/theme'
import type { PaletteColorLevel, ThemePalette, ThemePresetRegistry } from '@soybeanjs/theme'

export type ThemePaletteColors = Record<PaletteColorLevel, { hsl: string; oklch: string }>

export interface RuntimeThemePalette {
  name: string
  family: ThemePalette['family']
  colors: ThemePaletteColors
}

export interface ThemePaletteSlot {
  readonly key: string
  update(palette: RuntimeThemePalette): void
  dispose(): void
}

export const themePaletteLevels = paletteColorLevels

extend([oklabPlugin])

/** Normalize a picked level to both color spaces used by the theme engine. */
export function normalizeThemePaletteColor(input: string): { hsl: string; oklch: string } {
  const color = colord(input)
  if (!color.isValid()) throw new Error('Invalid palette color')
  const opaque = color.alpha(1)
  return { hsl: opaque.toHslString(), oklch: opaque.toOklchString() }
}

/** Read colors from the current built-in/runtime registry for controlled palette selectors. */
export function getThemePaletteColors(
  key: string,
  target: 'base' | 'primary',
): Partial<ThemePaletteColors> {
  return getRegistry()[target][key]?.colors ?? {}
}

/** Generate the complete 50–950 color ramp persisted by tenant theme configuration. */
export function generateThemePaletteColors(seedColor: string): ThemePaletteColors {
  const hsl = generatePalette(seedColor, 'hslString')
  const oklch = generatePalette(seedColor, 'oklchString')
  return Object.fromEntries(
    paletteColorLevels.map((level) => [level, { hsl: hsl[level], oklch: oklch[level] }]),
  ) as ThemePaletteColors
}

/** Compute the published palette key without mutating the theme registry. */
export function themePaletteKey(palette: RuntimeThemePalette, target: 'base' | 'primary'): string {
  const source = `${target}:${palette.family}:${palette.name}:${paletteColorLevels
    .map((level) => `${palette.colors[level].hsl}:${palette.colors[level].oklch}`)
    .join('|')}`
  let hash = 2_166_136_261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `tenant-${target}-${(hash >>> 0).toString(36)}`
}

function registerPaletteUnderKey(
  palette: RuntimeThemePalette,
  target: 'base' | 'primary',
  key: string,
): void {
  const preset: ThemePalette = {
    name: palette.name,
    family: palette.family,
    colors: palette.colors,
  }
  const entries = { [key]: preset }
  if (target === 'base') registerThemePresets({ base: entries as ThemePresetRegistry['base'] })
  else registerThemePresets({ primary: entries as ThemePresetRegistry['primary'] })
}

/** Register a content-addressed tenant palette and return the engine key that selects it. */
export function registerThemePalette(
  palette: RuntimeThemePalette,
  target: 'base' | 'primary',
): string {
  const key = themePaletteKey(palette, target)
  registerPaletteUnderKey(palette, target, key)
  return key
}

let nextPaletteSlotId = 0

/** Keep draft edits in one temporary registry entry; dispose it when the preview unmounts. */
export function createThemePaletteSlot(target: 'base' | 'primary'): ThemePaletteSlot {
  const key = `tenant-preview-${target}-${(++nextPaletteSlotId).toString(36)}`
  let disposed = false
  return {
    key,
    update(palette) {
      if (disposed) throw new Error('Disposed theme palette slot')
      registerPaletteUnderKey(palette, target, key)
    },
    dispose() {
      if (disposed) return
      // The engine has no unregister API; its registry sections are mutable plain records.
      Reflect.deleteProperty(getRegistry()[target], key)
      disposed = true
    },
  }
}
