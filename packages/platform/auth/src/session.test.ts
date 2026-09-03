import { describe, expect, it } from 'vitest'

import { newTenantId, newUserId, type Clock } from '@jingwei/kernel'

import { SessionService, type SessionRepository, type SessionRow } from './session.js'

function createMemoryRepository(): SessionRepository {
  const rows = new Map<string, SessionRow>()

  return {
    insert(row) {
      rows.set(row.id, row)
      return Promise.resolve()
    },
    findActiveByTokenHash(tokenHash, now) {
      const row = [...rows.values()].find(
        (candidate) =>
          candidate.token_hash === tokenHash &&
          candidate.revoked_at === null &&
          candidate.idle_expires_at > now &&
          candidate.absolute_expires_at > now,
      )
      return Promise.resolve(row ?? null)
    },
    updateActivity(id, update) {
      const current = rows.get(id)
      if (current !== undefined) {
        rows.set(id, { ...current, ...update })
      }
      return Promise.resolve()
    },
    revoke(id, revokedAt) {
      const current = rows.get(id)
      if (current !== undefined) {
        rows.set(id, { ...current, revoked_at: revokedAt })
      }
      return Promise.resolve()
    },
    revokeUser(tenantId, userId, revokedAt) {
      for (const [id, row] of rows) {
        if (row.tenant_id === tenantId && row.user_id === userId) {
          rows.set(id, { ...row, revoked_at: revokedAt })
        }
      }
      return Promise.resolve()
    },
  }
}

describe('SessionService', () => {
  it('stores only token hashes and authenticates the opaque token', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z')
    const clock: Clock = { now: () => now }
    const service = new SessionService(createMemoryRepository(), clock, {
      idleSeconds: 60,
      absoluteSeconds: 600,
    })

    const created = await service.create({
      tenantId: newTenantId(),
      userId: newUserId(),
    })

    const authenticated = await service.authenticate(created.token)

    expect(authenticated?.id).toBe(created.id)
    expect(authenticated?.csrfTokenHash).not.toBe(created.csrfToken)
    await expect(service.authenticate('not-the-token')).resolves.toBeNull()
  })
})
