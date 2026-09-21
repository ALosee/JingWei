import { describe, expect, it } from 'vitest'

import { selectClientIp } from './request-metadata.js'

describe('client IP selection', () => {
  it('ignores forwarded headers until the deployment explicitly trusts its proxy', () => {
    expect(
      selectClientIp({
        trustProxy: false,
        directAddress: '10.0.0.8',
        forwardedFor: '203.0.113.20, 10.0.0.2',
      }),
    ).toBe('10.0.0.8')
  })

  it('uses the first forwarded address behind a trusted proxy', () => {
    expect(
      selectClientIp({
        trustProxy: true,
        directAddress: '10.0.0.8',
        forwardedFor: '203.0.113.20, 10.0.0.2',
      }),
    ).toBe('203.0.113.20')
  })
})
