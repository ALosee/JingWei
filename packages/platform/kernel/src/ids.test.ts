import { describe, expect, it } from 'vitest'

import { newTenantId, toTenantId } from './ids.js'

describe('UUID v7 identifiers', () => {
  it('creates and parses a UUID v7', () => {
    const id = newTenantId()

    expect(toTenantId(id)).toBe(id)
  })

  it('rejects a non-v7 identifier', () => {
    expect(() => toTenantId('550e8400-e29b-41d4-a716-446655440000')).toThrow(
      'TenantId must be a UUID v7',
    )
  })
})
