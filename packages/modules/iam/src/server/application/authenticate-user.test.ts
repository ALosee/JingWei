import { describe, expect, it, vi } from 'vitest'

import type { CreatedSession, PasswordHasher } from '@jingwei/auth'
import type { TenantDirectory, TenantSnapshot } from '@jingwei/database'
import { newRequestId, newSessionId, newTenantId, newUserId, type Clock } from '@jingwei/kernel'

import {
  AuthenticateUser,
  type AuthenticationTransaction,
  type AuthenticationUnitOfWork,
  type CredentialSnapshot,
  type CredentialStore,
} from './authenticate-user.js'

const now = new Date('2026-09-10T10:00:00.000Z')
const tenantId = newTenantId()
const userId = newUserId()
const requestId = newRequestId()

function credential(overrides: Partial<CredentialSnapshot> = {}): CredentialSnapshot {
  return {
    userId,
    displayName: 'Admin',
    status: 'ACTIVE',
    passwordHash: 'real-hash',
    lockedUntil: null,
    ...overrides,
  }
}

function createdSession(): CreatedSession {
  return {
    id: newSessionId(),
    tenantId,
    userId,
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
    csrfToken: 'csrf-secret',
    csrfTokenHash: 'csrf-hash',
    accessExpiresAt: new Date('2026-09-10T10:10:00.000Z'),
    absoluteExpiresAt: new Date('2026-09-17T10:00:00.000Z'),
  }
}

function createHarness(snapshot: CredentialSnapshot | null, passwordMatches = false) {
  const tenant: TenantSnapshot = {
    id: tenantId,
    code: 'default',
    name: 'Default',
    status: 'ACTIVE',
  }
  const tenants: TenantDirectory = {
    findActiveByCode: vi.fn(() => Promise.resolve(tenant)),
  }
  const findByLogin = vi.fn(() => Promise.resolve(snapshot))
  const recordFailure = vi.fn(() => Promise.resolve())
  const completeLogin = vi.fn(() => Promise.resolve())
  const credentials: CredentialStore = {
    findByLogin,
    recordFailure,
  }
  const transaction: AuthenticationTransaction = { completeLogin }
  const unitOfWork: AuthenticationUnitOfWork = {
    run: (work) => work(transaction),
  }
  const verify = vi.fn((hash: string) => Promise.resolve(hash === 'real-hash' && passwordMatches))
  const passwords: PasswordHasher = {
    hash: vi.fn(() => Promise.resolve('unused')),
    verify,
  }
  const session = createdSession()
  const create = vi.fn(() => Promise.resolve(session))
  const revoke = vi.fn(() => Promise.resolve())
  const sessions = {
    create,
    revoke,
  }
  const clock: Clock = { now: () => now }
  const authenticate = new AuthenticateUser({
    tenants,
    credentials,
    unitOfWork,
    passwords,
    sessions,
    clock,
    dummyPasswordHash: 'dummy-hash',
    policy: { maxFailedAttempts: 5, lockSeconds: 900 },
  })

  return {
    authenticate,
    create,
    findByLogin,
    recordFailure,
    completeLogin,
    revoke,
    session,
    verify,
  }
}

describe('AuthenticateUser', () => {
  it('runs a dummy Argon2 verification when the login does not exist', async () => {
    const { authenticate, recordFailure, verify } = createHarness(null)

    await expect(
      authenticate.execute(
        { tenantCode: 'default', login: 'missing', password: 'candidate' },
        { requestId },
      ),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED', status: 401 })

    expect(verify).toHaveBeenCalledWith('dummy-hash', 'candidate')
    expect(recordFailure).not.toHaveBeenCalled()
  })

  it('atomically records a failed password attempt using the configured lock policy', async () => {
    const { authenticate, create, recordFailure } = createHarness(credential())

    await expect(
      authenticate.execute(
        { tenantCode: 'default', login: 'admin', password: 'wrong' },
        { requestId },
      ),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED', status: 401 })

    expect(recordFailure).toHaveBeenCalledWith({
      userId,
      occurredAt: now,
      maxFailedAttempts: 5,
      lockSeconds: 900,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('does not unlock an account early even when the password is correct', async () => {
    const { authenticate, completeLogin, create, recordFailure, verify } = createHarness(
      credential({ lockedUntil: new Date('2026-09-10T10:01:00.000Z') }),
      true,
    )

    await expect(
      authenticate.execute(
        { tenantCode: 'default', login: 'admin', password: 'correct' },
        { requestId },
      ),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED', status: 401 })

    expect(verify).toHaveBeenCalledWith('real-hash', 'correct')
    expect(recordFailure).not.toHaveBeenCalled()
    expect(completeLogin).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('resets login security state, records last login, and creates a token family', async () => {
    const { authenticate, completeLogin, create, findByLogin, session } = createHarness(
      credential(),
      true,
    )

    const result = await authenticate.execute(
      { tenantCode: 'default', login: ' Admin ', password: 'correct' },
      { requestId, ipAddress: '127.0.0.1', userAgent: 'test' },
    )

    expect(findByLogin).toHaveBeenCalledWith(tenantId, 'admin')
    expect(completeLogin).toHaveBeenCalledWith({
      requestId,
      tenantId,
      userId,
      sessionId: session.id,
      occurredAt: now,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    })
    expect(create).toHaveBeenCalledWith({
      tenantId,
      userId,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    })
    expect(result.session).toBe(session)
  })

  it('revokes the unpublished token family when recording login success fails', async () => {
    const { authenticate, completeLogin, revoke, session } = createHarness(credential(), true)
    completeLogin.mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(
      authenticate.execute(
        { tenantCode: 'default', login: 'admin', password: 'correct' },
        { requestId },
      ),
    ).rejects.toThrow('audit unavailable')

    expect(revoke).toHaveBeenCalledWith(session.id, 'LOGIN_FINALIZATION_FAILED')
  })
})
