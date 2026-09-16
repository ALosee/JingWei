import { describe, expect, it } from 'vitest'

import type { OrganizationalScopeFacts } from '../public/authorization.js'
import { mergeDataScopes, type ScopeGrantInput } from './merge-data-scopes.js'

function createPort(options?: {
  members?: readonly string[]
  descendants?: Record<string, readonly string[]>
  valid?: readonly string[]
}) {
  const calls = { members: 0, descendants: 0, valid: 0 }
  const port: OrganizationalScopeFacts = {
    memberOrgUnitIds() {
      calls.members += 1
      return Promise.resolve(options?.members ?? [])
    },
    descendantsOf(_tenantId, orgUnitIds) {
      calls.descendants += 1
      const result = new Set<string>()
      for (const id of orgUnitIds) {
        result.add(id)
        for (const child of options?.descendants?.[id] ?? []) result.add(child)
      }
      return Promise.resolve([...result])
    },
    validOrgUnitIds(_tenantId, orgUnitIds) {
      calls.valid += 1
      return Promise.resolve(options?.valid ?? orgUnitIds)
    },
  }
  return { port, calls }
}

const grant = (scopeType: ScopeGrantInput['scopeType'], organizationIds: string[] = []) => ({
  scopeType,
  organizationIds,
})

describe('mergeDataScopes', () => {
  it('returns ALL when any role grant is ALL', async () => {
    const { port, calls } = createPort()
    const result = await mergeDataScopes([grant('SELF'), grant('ALL')], port, 'tenant', 'user')
    expect(result).toEqual({ type: 'ALL', organizationIds: [], includeSelf: false })
    expect(calls.members).toBe(0)
  })

  it('expands ORGANIZATION from membership only', async () => {
    const { port } = createPort({ members: ['org-a'] })
    const result = await mergeDataScopes([grant('ORGANIZATION')], port, 't', 'u')
    expect(result.type).toBe('ORGANIZATION')
    expect(result.organizationIds).toEqual(['org-a'])
    expect(result.includeSelf).toBe(false)
  })

  it('expands ORGANIZATION_AND_DESCENDANTS via descendants port', async () => {
    const { port, calls } = createPort({
      members: ['org-a'],
      descendants: { 'org-a': ['org-a', 'org-b', 'org-c'] },
    })
    const result = await mergeDataScopes([grant('ORGANIZATION_AND_DESCENDANTS')], port, 't', 'u')
    expect(result.type).toBe('ORGANIZATION_AND_DESCENDANTS')
    expect(result.organizationIds).toEqual(['org-a', 'org-b', 'org-c'])
    expect(calls.descendants).toBe(1)
  })

  it('unions CUSTOM org ids and reports CUSTOM when mixed with ORGANIZATION', async () => {
    const { port } = createPort({ members: ['org-a'] })
    const result = await mergeDataScopes(
      [grant('ORGANIZATION'), grant('CUSTOM', ['org-z'])],
      port,
      't',
      'u',
    )
    expect(result.type).toBe('CUSTOM')
    expect(result.organizationIds).toEqual(['org-a', 'org-z'])
  })

  it('rejects CUSTOM org ids that do not exist in the current tenant', async () => {
    const { port, calls } = createPort({ valid: ['org-a'] })
    await expect(
      mergeDataScopes([grant('CUSTOM', ['org-a', 'other-tenant-org'])], port, 't', 'u'),
    ).rejects.toThrow('unknown organization unit')
    expect(calls.valid).toBe(1)
  })

  it('marks includeSelf when SELF unions with org scopes', async () => {
    const { port } = createPort({ members: ['org-a'] })
    const result = await mergeDataScopes([grant('SELF'), grant('ORGANIZATION')], port, 't', 'u')
    expect(result.type).toBe('CUSTOM')
    expect(result.includeSelf).toBe(true)
    expect(result.organizationIds).toEqual(['org-a'])
  })

  it('returns SELF when only SELF is granted', async () => {
    const { port } = createPort()
    const result = await mergeDataScopes([grant('SELF')], port, 't', 'u')
    expect(result).toEqual({ type: 'SELF', organizationIds: [], includeSelf: true })
  })

  it('returns empty CUSTOM when org membership is empty', async () => {
    const { port } = createPort({ members: [] })
    const result = await mergeDataScopes([grant('ORGANIZATION_AND_DESCENDANTS')], port, 't', 'u')
    expect(result.type).toBe('CUSTOM')
    expect(result.organizationIds).toEqual([])
  })
})
