import { describe, expect, it, vi } from 'vitest'

import type { PasswordHasher } from '@jingwei/auth'
import { newOperatorId, newRequestId, newSessionId, type Clock } from '@jingwei/kernel'

import {
  AuthenticateOperator,
  type OperatorCredentialSnapshot,
  type OperatorCredentialStore,
  type OperatorSessionIssuer,
} from './operator-auth.js'

const now = new Date('2026-09-21T09:00:00.000Z')
const operatorId = newOperatorId()
const requestId = newRequestId()

function credential(
  overrides: Partial<OperatorCredentialSnapshot> = {},
): OperatorCredentialSnapshot {
  return {
    id: operatorId,
    login: 'platform-admin',
    displayName: '平台管理员',
    status: 'ACTIVE',
    passwordHash: 'real-hash',
    lockedUntil: null,
    ...overrides,
  }
}

function createHarness(snapshot: OperatorCredentialSnapshot | null, passwordMatches = false) {
  const findByLogin = vi.fn(() => Promise.resolve(snapshot))
  const recordFailure = vi.fn(() => Promise.resolve())
  const recordRejectedLogin = vi.fn(() => Promise.resolve())
  const completeLogin = vi.fn(() => Promise.resolve())
  const credentials: OperatorCredentialStore = {
    findByLogin,
    recordFailure,
    recordRejectedLogin,
    completeLogin,
    findActiveById: vi.fn(() => Promise.resolve(null)),
  }
  const verify = vi.fn((hash: string) => Promise.resolve(hash === 'real-hash' && passwordMatches))
  const passwords: PasswordHasher = {
    hash: vi.fn(() => Promise.resolve('unused')),
    verify,
  }
  const session = {
    id: newSessionId(),
    operatorId,
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
    csrfToken: 'csrf-secret',
    csrfTokenHash: 'csrf-hash',
    accessExpiresAt: new Date('2026-09-21T09:10:00.000Z'),
    absoluteExpiresAt: new Date('2026-09-28T09:00:00.000Z'),
  }
  const create = vi.fn(() => Promise.resolve(session))
  const revoke = vi.fn(() => Promise.resolve())
  const sessions: OperatorSessionIssuer = { create, revoke }
  const clock: Clock = { now: () => now }
  return {
    authenticate: new AuthenticateOperator(credentials, passwords, sessions, clock, 'dummy-hash', {
      maxFailedAttempts: 5,
      lockSeconds: 900,
    }),
    findByLogin,
    recordFailure,
    recordRejectedLogin,
    completeLogin,
    create,
    revoke,
    verify,
    session,
  }
}

describe('AuthenticateOperator', () => {
  it('does dummy verification and returns a generic error for an unknown operator', async () => {
    const harness = createHarness(null)

    await expect(
      harness.authenticate.execute({ login: 'missing', password: 'candidate' }, { requestId }),
    ).rejects.toMatchObject({ code: 'PLATFORM_AUTHENTICATION_FAILED', status: 401 })
    expect(harness.verify).toHaveBeenCalledWith('dummy-hash', 'candidate')
    expect(harness.recordRejectedLogin).toHaveBeenCalledWith(
      { requestId, actor: { type: 'SYSTEM', id: 'platform-authentication' } },
      { entityId: 'unknown-operator', occurredAt: now, reason: 'UNKNOWN_OPERATOR' },
    )
    expect(harness.create).not.toHaveBeenCalled()
  })

  it('records failures under the platform operator instead of a tenant user', async () => {
    const harness = createHarness(credential())

    await expect(
      harness.authenticate.execute({ login: 'platform-admin', password: 'wrong' }, { requestId }),
    ).rejects.toMatchObject({ code: 'PLATFORM_AUTHENTICATION_FAILED' })
    expect(harness.recordFailure).toHaveBeenCalledWith(
      { requestId, actor: { type: 'SYSTEM', id: 'platform-authentication' } },
      {
        operatorId,
        occurredAt: now,
        maxFailedAttempts: 5,
        lockSeconds: 900,
      },
    )
  })

  it('performs real password verification before rejecting a locked operator', async () => {
    const harness = createHarness(
      credential({ lockedUntil: new Date('2026-09-21T09:01:00.000Z') }),
      true,
    )

    await expect(
      harness.authenticate.execute({ login: 'platform-admin', password: 'correct' }, { requestId }),
    ).rejects.toMatchObject({ code: 'PLATFORM_AUTHENTICATION_FAILED' })
    expect(harness.verify).toHaveBeenCalledWith('real-hash', 'correct')
    expect(harness.recordRejectedLogin).toHaveBeenCalledWith(
      { requestId, actor: { type: 'SYSTEM', id: 'platform-authentication' } },
      { entityId: operatorId, occurredAt: now, reason: 'OPERATOR_UNAVAILABLE' },
    )
  })

  it('creates an independent operator session and finalizes the platform audit actor', async () => {
    const harness = createHarness(credential(), true)

    const result = await harness.authenticate.execute(
      { login: ' Platform-Admin ', password: 'correct' },
      { requestId, ipAddress: '127.0.0.1', userAgent: 'test' },
    )

    expect(harness.findByLogin).toHaveBeenCalledWith('platform-admin')
    expect(harness.create).toHaveBeenCalledWith({
      operatorId,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    })
    expect(harness.completeLogin).toHaveBeenCalledWith(
      {
        requestId,
        actor: { type: 'PLATFORM_OPERATOR', id: operatorId },
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      },
      operatorId,
      now,
    )
    expect(result).toMatchObject({ operator: { id: operatorId }, session: harness.session })
  })

  it('revokes a new session when login finalization fails', async () => {
    const harness = createHarness(credential(), true)
    harness.completeLogin.mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(
      harness.authenticate.execute({ login: 'platform-admin', password: 'correct' }, { requestId }),
    ).rejects.toThrow('audit unavailable')
    expect(harness.revoke).toHaveBeenCalledWith(harness.session.id, 'LOGIN_FINALIZATION_FAILED')
  })
})
