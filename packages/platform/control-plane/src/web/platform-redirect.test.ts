import { describe, expect, it } from 'vitest'

import { safePlatformRedirect } from './platform-redirect.js'

describe('safePlatformRedirect', () => {
  const origin = 'http://127.0.0.1:5173'

  it('preserves normalized platform paths', () => {
    expect(safePlatformRedirect('/platform/tenants?id=1#details', origin)).toBe(
      '/platform/tenants?id=1#details',
    )
  })

  it.each([
    null,
    '/platform-foo',
    '/platform/../tenant',
    '//attacker.example/platform',
    '/\\attacker.example/platform',
    'https://attacker.example/platform',
  ])('falls back for a non-platform redirect: %s', (value) => {
    expect(safePlatformRedirect(value, origin)).toBe('/platform/tenants')
  })
})
