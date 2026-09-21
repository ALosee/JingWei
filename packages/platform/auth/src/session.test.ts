import { describe, expect, it } from 'vitest'

import { newTenantId, newUserId, type Clock } from '@jingwei/kernel'

import {
  hashOpaqueToken,
  SessionService,
  type RefreshTokenRow,
  type SessionRepository,
  type SessionRow,
} from './session.js'

interface MemoryStore {
  readonly repository: SessionRepository
  readonly refreshTokens: Map<string, RefreshTokenRow>
  readonly sessions: Map<string, SessionRow>
}

function createMemoryStore(): MemoryStore {
  const sessions = new Map<string, SessionRow>()
  const refreshTokens = new Map<string, RefreshTokenRow>()

  const repository: SessionRepository = {
    create(session, refreshToken) {
      sessions.set(session.id, session)
      refreshTokens.set(refreshToken.token_hash, refreshToken)
      return Promise.resolve()
    },
    findActiveByAccessTokenHash(tokenHash, now) {
      const row = [...sessions.values()].find(
        (candidate) =>
          candidate.access_token_hash === tokenHash &&
          candidate.access_expires_at > now &&
          isActive(candidate, now),
      )
      return Promise.resolve(row ?? null)
    },
    findByRefreshTokenHash(tokenHash) {
      const token = refreshTokens.get(tokenHash)
      if (token === undefined) return Promise.resolve(null)
      const session = sessions.get(token.session_id)
      return Promise.resolve(session === undefined ? null : { session, token })
    },
    rotateRefreshToken(input) {
      const token = refreshTokens.get(input.presentedTokenHash)
      const session = token === undefined ? undefined : sessions.get(token.session_id)
      if (
        token === undefined ||
        session === undefined ||
        !isActive(session, input.now) ||
        token.expires_at <= input.now
      ) {
        return Promise.resolve({ status: 'invalid' })
      }
      if (token.consumed_at !== null) {
        if (input.now.getTime() <= token.consumed_at.getTime() + input.reuseGraceSeconds * 1_000) {
          return Promise.resolve({ status: 'already_rotated' })
        }
        const revokedSession = {
          ...session,
          revoked_at: input.now,
          revocation_reason: 'REFRESH_TOKEN_REUSE',
        }
        sessions.set(session.id, revokedSession)
        return Promise.resolve({ status: 'reused', session: revokedSession })
      }

      refreshTokens.set(token.token_hash, { ...token, consumed_at: input.now })
      refreshTokens.set(input.nextToken.token_hash, input.nextToken)
      const nextSession = {
        ...session,
        access_token_hash: input.nextAccessTokenHash,
        access_expires_at: input.nextAccessExpiresAt,
        last_seen_at: input.now,
        idle_expires_at: input.nextIdleExpiresAt,
      }
      sessions.set(session.id, nextSession)
      return Promise.resolve({ status: 'rotated', session: nextSession })
    },
    updateActivity(id, update) {
      const current = sessions.get(id)
      if (current !== undefined) sessions.set(id, { ...current, ...update })
      return Promise.resolve()
    },
    revoke(id, revokedAt, reason) {
      const current = sessions.get(id)
      if (current !== undefined) {
        sessions.set(id, { ...current, revoked_at: revokedAt, revocation_reason: reason })
      }
      return Promise.resolve()
    },
    revokeUser(tenantId, userId, revokedAt, reason) {
      for (const [id, row] of sessions) {
        if (row.tenant_id === tenantId && row.user_id === userId) {
          sessions.set(id, { ...row, revoked_at: revokedAt, revocation_reason: reason })
        }
      }
      return Promise.resolve()
    },
    revokeTenant(tenantId, revokedAt, reason) {
      for (const [id, row] of sessions) {
        if (row.tenant_id === tenantId) {
          sessions.set(id, { ...row, revoked_at: revokedAt, revocation_reason: reason })
        }
      }
      return Promise.resolve()
    },
  }

  return { repository, refreshTokens, sessions }
}

function createFixture() {
  let now = new Date('2026-09-01T00:00:00.000Z')
  let tenantActive = true
  const clock: Clock = { now: () => now }
  const store = createMemoryStore()
  const service = new SessionService(
    store.repository,
    clock,
    {
      accessSeconds: 60,
      refreshIdleSeconds: 120,
      refreshAbsoluteSeconds: 600,
      refreshReuseGraceSeconds: 5,
    },
    { isActive: () => Promise.resolve(tenantActive) },
  )
  return {
    service,
    store,
    advance(seconds: number) {
      now = new Date(now.getTime() + seconds * 1_000)
    },
    setTenantActive(active: boolean) {
      tenantActive = active
    },
  }
}

describe('SessionService', () => {
  it('stores only access and refresh hashes and authenticates the access token', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({
      tenantId: newTenantId(),
      userId: newUserId(),
    })

    expect(created.accessToken).not.toBe(created.refreshToken)
    expect(created.accessExpiresAt.toISOString()).toBe('2026-09-01T00:01:00.000Z')
    expect(created.absoluteExpiresAt.toISOString()).toBe('2026-09-01T00:10:00.000Z')
    expect([...fixture.store.sessions.values()][0]?.access_token_hash).toBe(
      hashOpaqueToken(created.accessToken),
    )
    expect(fixture.store.refreshTokens.has(hashOpaqueToken(created.refreshToken))).toBe(true)
    expect(JSON.stringify([...fixture.store.sessions.values()])).not.toContain(created.accessToken)
    expect(JSON.stringify([...fixture.store.refreshTokens.values()])).not.toContain(
      created.refreshToken,
    )

    await expect(fixture.service.authenticateAccess(created.accessToken)).resolves.toMatchObject({
      id: created.id,
      tenantId: created.tenantId,
      userId: created.userId,
    })
    await expect(fixture.service.authenticateAccess('not-the-token')).resolves.toBeNull()
  })

  it('rotates both credentials and revokes the family when an old refresh token is reused', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({
      tenantId: newTenantId(),
      userId: newUserId(),
    })
    fixture.advance(61)
    await expect(fixture.service.authenticateAccess(created.accessToken)).resolves.toBeNull()

    const refreshed = await fixture.service.refresh({
      refreshToken: created.refreshToken,
      csrfCookieToken: created.csrfToken,
      csrfHeaderToken: created.csrfToken,
    })
    expect(refreshed.status).toBe('refreshed')
    if (refreshed.status !== 'refreshed') throw new Error('Expected refreshed session')
    expect(refreshed.session.accessToken).not.toBe(created.accessToken)
    expect(refreshed.session.refreshToken).not.toBe(created.refreshToken)
    await expect(
      fixture.service.authenticateAccess(refreshed.session.accessToken),
    ).resolves.toMatchObject({ id: created.id })

    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toEqual({ status: 'already_rotated' })

    fixture.advance(6)
    const reused = await fixture.service.refresh({
      refreshToken: created.refreshToken,
      csrfCookieToken: created.csrfToken,
      csrfHeaderToken: created.csrfToken,
    })
    expect(reused).toMatchObject({ status: 'reused', session: { id: created.id } })
    await expect(
      fixture.service.authenticateAccess(refreshed.session.accessToken),
    ).resolves.toBeNull()
    expect(fixture.store.sessions.get(created.id)?.revocation_reason).toBe('REFRESH_TOKEN_REUSE')
  })

  it('does not consume a refresh token when CSRF verification fails', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({
      tenantId: newTenantId(),
      userId: newUserId(),
    })

    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: 'wrong-csrf',
      }),
    ).resolves.toEqual({ status: 'csrf_invalid' })
    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toMatchObject({ status: 'refreshed' })
  })

  it('enforces refresh idle expiry independently of the absolute limit', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({
      tenantId: newTenantId(),
      userId: newUserId(),
    })
    fixture.advance(121)

    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toEqual({ status: 'invalid' })
  })

  it('revokes access and refresh credentials when the tenant becomes inactive', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({
      tenantId: newTenantId(),
      userId: newUserId(),
    })
    fixture.setTenantActive(false)

    await expect(fixture.service.authenticateAccess(created.accessToken)).resolves.toBeNull()
    expect(fixture.store.sessions.get(created.id)?.revocation_reason).toBe('TENANT_INACTIVE')
    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toEqual({ status: 'invalid' })
  })

  it('refuses to create a session for an inactive tenant', async () => {
    const fixture = createFixture()
    fixture.setTenantActive(false)

    await expect(
      fixture.service.create({ tenantId: newTenantId(), userId: newUserId() }),
    ).rejects.toMatchObject({ name: 'TenantInactiveSessionError' })
    expect(fixture.store.sessions.size).toBe(0)
  })
})

function isActive(row: SessionRow, now: Date): boolean {
  return row.revoked_at === null && row.idle_expires_at > now && row.absolute_expires_at > now
}
