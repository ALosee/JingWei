import { colord } from '@soybeanjs/colord'
import { ALPHA_TOKENS, DEFAULT_OPTIONS, SEMANTIC_TOKENS } from '@vean/theme'
import type { ColorFormat, SemanticToken, TokenPrefix } from '@vean/theme'

// Vean already owns the alpha companions of borders, inputs and masks.
export const additionalAlphaTokens = SEMANTIC_TOKENS.filter(
  (token) => !ALPHA_TOKENS.some((native) => native === token),
)

export function themeVariable(token: string, prefix: TokenPrefix): string {
  return `--${prefix ? `${prefix}-` : ''}${token}`
}

/** Recover opacity that the native channel-only map cannot carry. */
export function themeOverrideAlpha(value: string | undefined): number {
  if (value === 'transparent') return 0
  const color = colord(value ?? '')
  return color.isValid() ? color.alpha() : 1
}

/** Compose semantic opacity after UnoCSS resolves utility opacity, e.g. bg-card/40. */
export function withThemeColorAlpha(
  value: string,
  prefix: TokenPrefix = DEFAULT_OPTIONS.prefix,
): string {
  const variables = new Set(additionalAlphaTokens.map((token) => themeVariable(token, prefix)))
  return value.replace(
    /\b(hsl|oklch)\(var\((--[\w-]+)\)(?:\s*\/\s*(var\([^()]+\)|[\d.]+%?))?\)/g,
    (color: string, format: string, variable: string, alpha: string | undefined) =>
      variables.has(variable)
        ? `${format}(var(${variable}) / calc(var(${variable}-alpha, 1) * ${alpha ?? '1'}))`
        : color,
  )
}

/** The body uses semantic colors directly rather than generated utilities. */
export function buildThemeBodyCss(
  format: ColorFormat = DEFAULT_OPTIONS.format,
  prefix: TokenPrefix = DEFAULT_OPTIONS.prefix,
): string {
  const color = (token: SemanticToken) =>
    `${format}(var(${themeVariable(token, prefix)}) / var(${themeVariable(`${token}-alpha`, prefix)}, 1))`
  return `body { color: ${color('foreground')}; background-color: ${color('background')}; }`
}
