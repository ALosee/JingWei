import { describe, expect, it, vi } from 'vitest'

import {
  ApplicationError,
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
} from '@jingwei/kernel'
import type { AppLogger } from '@jingwei/observability'

import { observeAuthorization } from './authorization-telemetry.js'

const context = {
  requestId: newRequestId(),
  sessionId: newSessionId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  roleIds: [],
}

function logger() {
  return {
    child: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies AppLogger
}

describe('authorization telemetry', () => {
  it('records allowed and denied decisions without changing their result', async () => {
    const allowedLogger = logger()
    await expect(
      observeAuthorization({
        logger: allowedLogger,
        context,
        permission: 'iam.role.view',
        evaluator: 'UNSCOPED',
        evaluate: () => Promise.resolve('allowed'),
      }),
    ).resolves.toBe('allowed')
    expect(allowedLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'ALLOWED', permission: 'iam.role.view' }),
      'iam.authorization.evaluated',
    )

    const deniedLogger = logger()
    const denied = new ApplicationError({
      code: 'PERMISSION_DENIED',
      message: 'Denied',
      status: 403,
    })
    await expect(
      observeAuthorization({
        logger: deniedLogger,
        context,
        permission: 'iam.role.view',
        evaluator: 'UNSCOPED',
        evaluate: () => Promise.reject(denied),
      }),
    ).rejects.toBe(denied)
    expect(deniedLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'DENIED' }),
      'iam.authorization.evaluated',
    )
  })

  it('warns on evaluator failures', async () => {
    const appLogger = logger()
    const failure = new Error('database unavailable')
    await expect(
      observeAuthorization({
        logger: appLogger,
        context,
        permission: 'organization.view',
        evaluator: 'SCOPED',
        evaluate: () => Promise.reject(failure),
      }),
    ).rejects.toBe(failure)
    expect(appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'FAILED' }),
      'iam.authorization.evaluated',
    )
  })
})
