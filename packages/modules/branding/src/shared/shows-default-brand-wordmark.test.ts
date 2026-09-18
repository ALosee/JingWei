import { describe, expect, it } from 'vitest'

import { resolveHorizontalBrandMode } from './index.js'

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
