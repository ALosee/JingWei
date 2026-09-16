import { describe, expect, it, vi } from 'vitest'

import { newRequestId, newSessionId, newTenantId, newUserId } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import { ReadOrganizationalScopeOptions } from './read-scope-options.js'

const context = {
  requestId: newRequestId(),
  sessionId: newSessionId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  roleIds: [],
}

describe('ReadOrganizationalScopeOptions', () => {
  it('uses central role-management authority and returns only enabled tenant units', async () => {
    const requireUnscopedPermission = vi.fn(() => Promise.resolve())
    const access: IamAccess = {
      activeRoleIds: () => Promise.resolve([]),
      roles: () => Promise.resolve([]),
      effectivePermissionCodes: () => Promise.resolve([]),
      requireUnscopedPermission,
    }
    const result = await new ReadOrganizationalScopeOptions(
      {
        list: () =>
          Promise.resolve([
            {
              id: newUserId(),
              parentId: null,
              code: 'enabled',
              name: '启用组织',
              type: 'DEPARTMENT',
              status: 'ENABLED',
              sortOrder: 0,
              createdAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString(),
            },
            {
              id: newUserId(),
              parentId: null,
              code: 'disabled',
              name: '停用组织',
              type: 'DEPARTMENT',
              status: 'DISABLED',
              sortOrder: 1,
              createdAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString(),
            },
          ]),
      },
      access,
    ).list(context)

    expect(requireUnscopedPermission).toHaveBeenCalledWith(
      context,
      'iam.role.manage',
      'iam.authorization',
    )
    expect(result.units.map(({ code }) => code)).toEqual(['enabled'])
  })
})
