import { createGenerator } from 'unocss'
import { describe, expect, it } from 'vitest'

import unoConfig from '../../uno.config'

describe('semantic color utilities', () => {
  it('replaces stale color mappings during development configuration reloads', async () => {
    const generator = await createGenerator(unoConfig, {
      envMode: 'dev',
      theme: {
        colors: {
          card: 'hsl(var(--card) / calc(var(--card-alpha, 1) * <alpha-value>))',
          primary: 'hsl(var(--primary) / calc(var(--primary-alpha, 1) * <alpha-value>))',
        },
      },
    })
    const { css } = await generator.generate('bg-card text-primary text-muted-foreground')
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('<alpha-value>')
    expect(css).toContain('--un-text-opacity:1')
    expect(css).toContain('--un-bg-opacity:1')
    await generator.setConfig(unoConfig)
    const reloaded = await generator.generate('bg-card text-primary')
    expect(reloaded.css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('<alpha-value>')
    expect(reloaded.css).toContain('--un-text-opacity:1')
  })

  it('composes card opacity with utility opacity and retains native border alpha', async () => {
    const generator = await createGenerator(unoConfig)
    const { css } = await generator.generate('bg-card bg-card/40 border-border', {
      preflights: true,
    })
    expect(css).toContain('calc(var(--card-alpha, 1) * var(--un-bg-opacity))')
    expect(css).toContain('calc(var(--card-alpha, 1) * 0.4)')
    expect(css).toContain('var(--border-alpha, 1)')
    expect(css).toContain('background-color: hsl(var(--background) / var(--background-alpha, 1))')
  })
})
