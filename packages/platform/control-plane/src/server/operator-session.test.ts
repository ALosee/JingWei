import { describe, expect, it } from 'vitest'

import { hashOpaqueToken } from '@jingwei/auth'
import { newOperatorId, type Clock } from '@jingwei/kernel'

import {
  OperatorSessionService,
  type OperatorRefreshTokenRow,
  type OperatorSessionRepository,
  type OperatorSessionRow,
} from './operator-session.js'

function createFixture() {
  let now = new Date('2026-09-21T00:00:00.000Z')
  let operatorActive = true
  const sessions = new Map<string, OperatorSessionRow>()
  const refreshTokens = new Map<string, OperatorRefreshTokenRow>()
  const repository: OperatorSessionRepository = {
    create(session, refreshToken) {
      sessions.set(session.id, session)
      refreshTokens.set(refreshToken.token_hash, refreshToken)
      return Promise.resolve()
    },
    findActiveByAccessTokenHash(tokenHash, at) {
      const row = [...sessions.values()].find(
        (candidate) =>
          candidate.access_token_hash === tokenHash &&
          candidate.access_expires_at > at &&
          isActive(candidate, at),
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
        token.expires_at <= input.now ||
        !isActive(session, input.now)
      ) {
        return Promise.resolve({ status: 'invalid' })
      }
      if (token.consumed_at !== null) {
        if (input.now.getTime() <= token.consumed_at.getTime() + input.reuseGraceSeconds * 1_000) {
          return Promise.resolve({ status: 'already_rotated' })
        }
        const revoked = {
          ...session,
          revoked_at: input.now,
          revocation_reason: 'REFRESH_TOKEN_REUSE',
        }
        sessions.set(session.id, revoked)
        return Promise.resolve({ status: 'reused', session: revoked })
      }
      refreshTokens.set(token.token_hash, { ...token, consumed_at: input.now })
      refreshTokens.set(input.nextToken.token_hash, input.nextToken)
      const rotated = {
        ...session,
        access_token_hash: input.nextAccessTokenHash,
        access_expires_at: input.nextAccessExpiresAt,
        last_seen_at: input.now,
        idle_expires_at: input.nextIdleExpiresAt,
      }
      sessions.set(session.id, rotated)
      return Promise.resolve({ status: 'rotated', session: rotated })
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
  }
  const clock: Clock = { now: () => now }
  const service = new OperatorSessionService(
    repository,
    { isActive: () => Promise.resolve(operatorActive) },
    clock,
    {
      accessSeconds: 60,
      refreshIdleSeconds: 120,
      refreshAbsoluteSeconds: 600,
      refreshReuseGraceSeconds: 5,
    },
  )
  return {
    service,
    sessions,
    refreshTokens,
    advance(seconds: number) {
      now = new Date(now.getTime() + seconds * 1_000)
    },
    disableOperator() {
      operatorActive = false
    },
  }
}

describe('OperatorSessionService', () => {
  it('stores only opaque token hashes and rotates the refresh family', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({ operatorId: newOperatorId() })

    expect([...fixture.sessions.values()][0]?.access_token_hash).toBe(
      hashOpaqueToken(created.accessToken),
    )
    expect(fixture.refreshTokens.has(hashOpaqueToken(created.refreshToken))).toBe(true)
    expect(JSON.stringify([...fixture.sessions.values()])).not.toContain(created.accessToken)

    const refreshed = await fixture.service.refresh({
      refreshToken: created.refreshToken,
      csrfCookieToken: created.csrfToken,
      csrfHeaderToken: created.csrfToken,
    })
    expect(refreshed.status).toBe('refreshed')
    if (refreshed.status !== 'refreshed') throw new Error('Expected refreshed operator session')
    expect(refreshed.session.accessToken).not.toBe(created.accessToken)

    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toEqual({ status: 'already_rotated' })
    fixture.advance(6)
    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toMatchObject({ status: 'reused', session: { id: created.id } })
  })

  it('fails closed and revokes a session when the platform operator is disabled', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create({ operatorId: newOperatorId() })
    fixture.disableOperator()

    await expect(fixture.service.authenticateAccess(created.accessToken)).resolves.toBeNull()
    expect(fixture.sessions.get(created.id)?.revocation_reason).toBe('OPERATOR_DISABLED')
    await expect(
      fixture.service.refresh({
        refreshToken: created.refreshToken,
        csrfCookieToken: created.csrfToken,
        csrfHeaderToken: created.csrfToken,
      }),
    ).resolves.toEqual({ status: 'invalid' })
  })
})

function isActive(row: OperatorSessionRow, now: Date): boolean {
  return row.revoked_at === null && row.idle_expires_at > now && row.absolute_expires_at > now
}
