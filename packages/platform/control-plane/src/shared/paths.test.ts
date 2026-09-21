import { describe, expect, it } from 'vitest'

import { isPlatformApiPath, isPlatformWebPath } from './paths.js'

describe('platform URL namespace', () => {
  it('matches only complete platform path segments', () => {
    expect(isPlatformWebPath('/platform')).toBe(true)
    expect(isPlatformWebPath('/platform/login')).toBe(true)
    expect(isPlatformWebPath('/platform-foo')).toBe(false)
    expect(isPlatformApiPath('/api/v1/platform/tenants')).toBe(true)
    expect(isPlatformApiPath('/api/v1/platformx')).toBe(false)
  })
})
