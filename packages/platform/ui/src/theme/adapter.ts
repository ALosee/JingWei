import { colord } from '@soybeanjs/colord'
import { DEFAULT_OPTIONS, emitThemeCss, getDarkSelector, resolveThemeMap } from '@vean/theme'
import type { EmitThemeOptions } from '@vean/theme'

import { additionalAlphaTokens, themeOverrideAlpha, themeVariable } from './semantic-colors'
import type { RuntimeThemeOptions } from './types'

/**
 * Bridge from the runtime theme state to the token engine.
 *
 * Native semantic channels cannot carry surface transparency. Keep their color
 * map and add numeric alpha companions consumed by the local UnoCSS color map.
 * The Provider and ThemeScope use this same path, including mode resets.
 */
export function buildThemeCss(options: RuntimeThemeOptions, emit?: EmitThemeOptions): string {
  const emission = {
    prefix: options.prefix ?? DEFAULT_OPTIONS.prefix,
    styleTarget: options.styleTarget ?? DEFAULT_OPTIONS.styleTarget,
    darkSelector: options.darkSelector ?? DEFAULT_OPTIONS.darkSelector,
    format: options.format ?? DEFAULT_OPTIONS.format,
    ...emit,
  }
  const nativeOverrides = (mode: 'light' | 'dark') =>
    Object.fromEntries(
      Object.entries(options.overrides?.[mode] ?? {}).map(([token, value]) => [
        token,
        value === 'transparent' ? 'hsl(0 0% 0% / 0)' : value,
      ]),
    )
  const css = emitThemeCss(
    resolveThemeMap({
      ...options,
      overrides: { light: nativeOverrides('light'), dark: nativeOverrides('dark') },
    }),
    emission,
  )
  const { format, prefix, styleTarget, darkSelector } = emission
  const alphaDeclarations = (mode: 'light' | 'dark') =>
    additionalAlphaTokens.map(
      (token) =>
        `  ${themeVariable(`${token}-alpha`, prefix)}: ${themeOverrideAlpha(options.overrides?.[mode]?.[token])};`,
    )
  const ramp = Object.entries(options.primaryRamp ?? {}).map(([level, value]) => {
    const color = colord(value)
    const complete = format === 'hsl' ? color.toHslString() : color.toOklchString()
    return `  ${themeVariable(`primary-${level}`, prefix)}: ${complete.slice(complete.indexOf('(') + 1, -1)};`
  })
  const block = (selector: string, declarations: string[]) => {
    const target = emission.weakSelectors ? `:where(${selector})` : selector
    return `${target} {\n${declarations.join('\n')}\n}`
  }
  const light = block(styleTarget, [...alphaDeclarations('light'), ...ramp])
  const dark =
    darkSelector === 'media'
      ? `${getDarkSelector(darkSelector)} {\n${block(styleTarget, alphaDeclarations('dark'))}\n}`
      : block(getDarkSelector(darkSelector), alphaDeclarations('dark'))
  return `${css}\n\n${light}\n\n${dark}`
}
