import { describe, expect, it, vi } from 'vitest'

import type { SessionSnapshot } from '@jingwei/auth'
import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type AuthContext,
} from '@jingwei/kernel'

import { SessionLifecycle } from './session-lifecycle.js'

const requestId = newRequestId()
const sessionId = newSessionId()
const tenantId = newTenantId()
const userId = newUserId()

function snapshot(): SessionSnapshot {
  return {
    id: sessionId,
    tenantId,
    userId,
    csrfTokenHash: 'csrf-hash',
    accessExpiresAt: new Date('2026-09-10T10:10:00.000Z'),
    absoluteExpiresAt: new Date('2026-09-17T10:00:00.000Z'),
  }
}

describe('SessionLifecycle', () => {
  it('audits refresh-token reuse against the affected token family', async () => {
    const refresh = vi.fn(() => Promise.resolve({ status: 'reused' as const, session: snapshot() }))
    const append = vi.fn(() => Promise.resolve())
    const lifecycle = new SessionLifecycle({
      sessions: { refresh, revoke: vi.fn() },
      audit: { append },
    })

    const result = await lifecycle.refresh({
      requestId,
      refreshToken: 'refresh-secret',
      csrfCookieToken: 'csrf-secret',
      csrfHeaderToken: 'csrf-secret',
    })

    expect(result.status).toBe('reused')
    expect(append).toHaveBeenCalledWith({
      context: { requestId, tenantId, userId },
      module: 'iam',
      action: 'authentication.refresh-token-reuse',
      entityType: 'AUTH_SESSION',
      entityId: sessionId,
      result: 'FAILURE',
    })
  })

  it('revokes and audits logout through the application service', async () => {
    const revoke = vi.fn(() => Promise.resolve())
    const append = vi.fn(() => Promise.resolve())
    const lifecycle = new SessionLifecycle({
      sessions: { refresh: vi.fn(), revoke },
      audit: { append },
    })
    const context: AuthContext = { requestId, sessionId, tenantId, userId, roleIds: [] }

    await lifecycle.logout(context)

    expect(revoke).toHaveBeenCalledWith(sessionId)
    expect(append).toHaveBeenCalledWith({
      context,
      module: 'iam',
      action: 'authentication.logout',
      entityType: 'AUTH_SESSION',
      entityId: sessionId,
      result: 'SUCCESS',
    })
  })
})
