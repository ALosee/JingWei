import { describe, expect, it } from 'vitest'

import {
  brandAssetSchema,
  defaultEffectiveBrand,
  effectiveBrandSchema,
  resolveHorizontalBrandMode,
} from './index.js'

describe('resolveHorizontalBrandMode', () => {
  it('keeps the explicitly selected platform wordmark or short name', () => {
    expect(resolveHorizontalBrandMode('PLATFORM_WORDMARK', null)).toBe('PLATFORM_WORDMARK')
    expect(resolveHorizontalBrandMode('SHORT_NAME', '/api/v1/branding/assets/x')).toBe('SHORT_NAME')
  })

  it('fails safely to the short name when a configured custom logo is unavailable', () => {
    expect(resolveHorizontalBrandMode('CUSTOM_LOGO', null)).toBe('SHORT_NAME')
    expect(resolveHorizontalBrandMode('CUSTOM_LOGO', '/api/v1/branding/assets/x')).toBe(
      'CUSTOM_LOGO',
    )
  })
})

describe('brand asset contracts', () => {
  const baseAsset = {
    id: '01995b6e-f0c0-7000-8000-000000000001',
    width: 32,
    height: 32,
    byteSize: 128,
    url: '/api/v1/branding/assets/01995b6e-f0c0-7000-8000-000000000001',
  }

  it('rejects purpose, media type and validation profile combinations that cannot be stored', () => {
    expect(
      brandAssetSchema.safeParse({
        ...baseAsset,
        purpose: 'LOGO',
        contentType: 'image/x-icon',
        validationProfile: 'ICO_V1',
      }).success,
    ).toBe(false)
    expect(
      brandAssetSchema.safeParse({
        ...baseAsset,
        purpose: 'FAVICON',
        contentType: 'image/x-icon',
        validationProfile: 'ICO_V1',
      }).success,
    ).toBe(true)
  })

  it('requires effective asset URLs and their purpose-specific media types together', () => {
    expect(
      effectiveBrandSchema.safeParse({
        ...defaultEffectiveBrand,
        logoUrl: baseAsset.url,
        logoContentType: null,
      }).success,
    ).toBe(false)
    expect(
      effectiveBrandSchema.safeParse({
        ...defaultEffectiveBrand,
        logoUrl: baseAsset.url,
        logoContentType: 'image/x-icon',
      }).success,
    ).toBe(false)
  })
})
