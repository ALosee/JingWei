// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'

import { defaultEffectiveBrand } from '../shared/index.js'
import { validateEffectiveBrandLogo } from './effective-brand-validation.js'

const assetId = '01995b6e-f0c0-7000-8000-000000000001'

describe('validateEffectiveBrandLogo', () => {
  it('revalidates an SVG before exposing its URL to renderers', async () => {
    const load = vi.fn(() =>
      Promise.resolve(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 24"><path d="M0 0h140v24H0z"/></svg>',
      ),
    )
    const brand = {
      ...defaultEffectiveBrand,
      horizontalBrandMode: 'CUSTOM_LOGO' as const,
      logoUrl: `/api/v1/branding/assets/${assetId}`,
      logoContentType: 'image/svg+xml' as const,
    }

    await expect(validateEffectiveBrandLogo(brand, load)).resolves.toBe(brand)
    expect(load).toHaveBeenCalledWith(assetId)
  })

  it('removes an SVG URL that fails browser-side validation', async () => {
    const brand = {
      ...defaultEffectiveBrand,
      horizontalBrandMode: 'CUSTOM_LOGO' as const,
      logoUrl: `/api/v1/branding/assets/${assetId}`,
      logoContentType: 'image/svg+xml' as const,
    }
    const result = await validateEffectiveBrandLogo(brand, () =>
      Promise.resolve(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"/>',
      ),
    )
    expect(result).toMatchObject({ logoUrl: null, logoContentType: null })
  })

  it('does not load PNG bytes for redundant client-side parsing', async () => {
    const load = vi.fn<(id: string) => Promise<string>>()
    const brand = {
      ...defaultEffectiveBrand,
      logoUrl: `/api/v1/branding/assets/${assetId}`,
      logoContentType: 'image/png' as const,
    }
    await expect(validateEffectiveBrandLogo(brand, load)).resolves.toBe(brand)
    expect(load).not.toHaveBeenCalled()
  })
})
