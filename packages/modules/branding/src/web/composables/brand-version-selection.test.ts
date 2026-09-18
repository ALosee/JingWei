import { describe, expect, it } from 'vitest'

import type { BrandAdmin } from '../../shared/index.js'
import { resolveBrandVersionSelection } from './brand-version-selection.js'

const history: BrandAdmin['versions'] = [
  {
    id: '01995b6e-f0c0-7000-8000-000000000001',
    revision: 2,
    editRevision: 0,
    status: 'PUBLISHED',
    publishedAt: '2026-09-18T00:00:00.000Z',
  },
]

describe('resolveBrandVersionSelection', () => {
  it('selects the current live version when one exists', () => {
    const admin: BrandAdmin = { publishedVersionId: history[0]?.id ?? null, versions: history }
    expect(resolveBrandVersionSelection(admin)).toBe(history[0]?.id)
  })

  it('selects the platform default instead of stale history after restoring defaults', () => {
    const admin: BrandAdmin = { publishedVersionId: null, versions: history }
    expect(resolveBrandVersionSelection(admin)).toBeNull()
  })

  it('honors an explicitly selected historical version', () => {
    const admin: BrandAdmin = { publishedVersionId: null, versions: history }
    expect(resolveBrandVersionSelection(admin, history[0]?.id ?? null)).toBe(history[0]?.id)
  })
})
