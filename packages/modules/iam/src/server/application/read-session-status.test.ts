import { describe, expect, it } from 'vitest'

import { newRequestId, newSessionId, newTenantId, newUserId } from '@jingwei/kernel'

import { ReadSessionStatus } from './read-session-status.js'

const tenantId = newTenantId()
const userId = newUserId()
const context = {
  requestId: newRequestId(),
  sessionId: newSessionId(),
  tenantId,
  userId,
  roleIds: [] as string[],
}

describe('ReadSessionStatus', () => {
  it('returns unauthenticated when the user is missing', async () => {
    const useCase = new ReadSessionStatus(
      { findActiveById: () => Promise.resolve(null) },
      { effectivePermissionCodes: () => Promise.resolve(['iam.role.view']) },
    )

    await expect(useCase.execute(context)).resolves.toEqual({ authenticated: false })
  })

  it('projects the user identity and live effective permission codes', async () => {
    const useCase = new ReadSessionStatus(
      {
        findActiveById: () =>
          Promise.resolve({
            id: userId,
            tenantId,
            displayName: 'Admin',
            avatarUrl: null,
          }),
      },
      { effectivePermissionCodes: () => Promise.resolve(['iam.role.manage', 'iam.role.view']) },
    )

    await expect(useCase.execute(context)).resolves.toEqual({
      authenticated: true,
      user: {
        id: userId,
        tenantId,
        displayName: 'Admin',
        avatarUrl: null,
      },
      permissions: ['iam.role.manage', 'iam.role.view'],
    })
  })
})
