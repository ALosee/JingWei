import { describe, expect, it } from 'vitest'

import { buildThemeCss } from './adapter'

describe('runtime theme transparency', () => {
  it('preserves transparent surfaces and resets alpha in the other mode', () => {
    const css = buildThemeCss({ overrides: { light: { card: 'transparent' } } })
    const light = [...css.matchAll(/:root \{([^}]*)\}/g)].at(-1)?.[1]
    const dark = [...css.matchAll(/\.dark \{([^}]*)\}/g)].at(-1)?.[1]
    expect(light).toContain('--card-alpha: 0;')
    expect(dark).toContain('--card-alpha: 1;')
  })

  it('keeps literal opacity without changing native border opacity', () => {
    const css = buildThemeCss({
      overrides: { light: { card: 'hsl(210 50% 50% / 0.4)', border: 'transparent' } },
    })
    expect(css).toContain('--card-alpha: 0.4;')
    expect(css).toContain('--border-alpha: 0;')
  })

  it('honors scoped selectors, token prefixes and opaque replacement themes', () => {
    const transparent = buildThemeCss(
      { overrides: { light: { card: 'transparent' }, dark: { card: 'transparent' } } },
      { styleTarget: ':root', darkSelector: '[data-preview].dark', prefix: 'vean' },
    )
    expect(transparent).toContain('[data-preview].dark {')
    expect(transparent).toContain('--vean-card-alpha: 0;')
    expect(buildThemeCss({ overrides: { light: { card: 'white' } } })).toContain('--card-alpha: 1;')
  })
})
