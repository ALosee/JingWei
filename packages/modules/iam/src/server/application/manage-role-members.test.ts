import { describe, expect, it, vi } from 'vitest'

import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type AuthContext,
} from '@jingwei/kernel'

import type { IamAccess } from '../public/navigation-access.js'
import { iamPermissionRequirements } from '../public/permission-requirements.js'
import { ManageRoleMembers } from './manage-role-members.js'
import type { RoleMemberStore, RoleMemberUnitOfWork } from './role-member-store.js'

const context: AuthContext = {
  requestId: newRequestId(),
  sessionId: newSessionId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  roleIds: [],
}
const roleId = newUserId(),
  memberId = newUserId(),
  snapshot = 'a'.repeat(64)

function fixture() {
  const store = {
    lockAdministration: vi.fn(() => Promise.resolve()),
    lockRole: vi.fn<RoleMemberStore['lockRole']>(() => Promise.resolve({ status: 'ACTIVE' })),
    snapshot: vi.fn(() => Promise.resolve({ userIds: [memberId], snapshot })),
    list: vi.fn(() => Promise.resolve({ members: [], total: 0 })),
    lockActiveUsers: vi.fn((_tenantId, ids) => Promise.resolve(ids)),
    add: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    hasActiveManager: vi.fn(() => Promise.resolve(true)),
  } satisfies RoleMemberStore
  const record = vi.fn(() => Promise.resolve())
  const work: RoleMemberUnitOfWork = { run: (callback) => callback({ store, record }) }
  const access = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: vi.fn(() => Promise.resolve()),
  } satisfies IamAccess
  return { store, record, access, manage: new ManageRoleMembers(work, access) }
}

describe('ManageRoleMembers', () => {
  it('requires both management permissions for mutations and candidate lookup', async () => {
    const { manage, access } = fixture()
    await manage.add(context, roleId, { userIds: [newUserId()], expectedSnapshot: snapshot })
    expect(access.requireUnscopedPermission).toHaveBeenCalledWith(
      context,
      iamPermissionRequirements.roleManage,
    )
    expect(access.requireUnscopedPermission).toHaveBeenCalledWith(
      context,
      iamPermissionRequirements.userManage,
    )
    vi.mocked(access.requireUnscopedPermission).mockClear()
    await manage.list(context, roleId, { page: 1, pageSize: 20, search: '' }, true)
    expect(access.requireUnscopedPermission).toHaveBeenCalledTimes(2)
  })

  it('rejects a stale confirmation before changing members', async () => {
    const { manage, store, record } = fixture()
    await expect(
      manage.clear(context, roleId, { expectedSnapshot: 'b'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'IAM_ROLE_MEMBERS_CONFLICT' })
    expect(store.clear).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })

  it('prevents adding unavailable users and adding to a disabled role', async () => {
    const { manage, store } = fixture()
    vi.mocked(store.lockActiveUsers).mockResolvedValue([])
    await expect(
      manage.add(context, roleId, { userIds: [newUserId()], expectedSnapshot: snapshot }),
    ).rejects.toMatchObject({ code: 'IAM_USER_NOT_AVAILABLE' })
    vi.mocked(store.lockRole).mockResolvedValue({ status: 'DISABLED' })
    await expect(
      manage.add(context, roleId, { userIds: [newUserId()], expectedSnapshot: snapshot }),
    ).rejects.toMatchObject({ code: 'IAM_ROLE_DISABLED' })
    expect(store.add).not.toHaveBeenCalled()
  })

  it('checks manager continuity on the whole batch, including the current user', async () => {
    const { manage, store, record } = fixture()
    vi.mocked(store.snapshot).mockResolvedValue({ userIds: [memberId, context.userId], snapshot })
    vi.mocked(store.hasActiveManager).mockResolvedValue(false)
    await expect(
      manage.clear(context, roleId, { expectedSnapshot: snapshot }),
    ).rejects.toMatchObject({ code: 'IAM_USER_LAST_MANAGER' })
    expect(store.clear).toHaveBeenCalledWith(context, roleId)
    expect(record).not.toHaveBeenCalled()
  })

  it('clears the full role and audits affected ids without filtering by displayed page', async () => {
    const { manage, store, record } = fixture()
    vi.mocked(store.snapshot)
      .mockResolvedValueOnce({ userIds: [memberId, context.userId], snapshot })
      .mockResolvedValueOnce({ userIds: [], snapshot: 'b'.repeat(64) })
    await expect(manage.clear(context, roleId, { expectedSnapshot: snapshot })).resolves.toEqual({
      affectedCount: 2,
      assignmentCount: 0,
      snapshot: 'b'.repeat(64),
      affectsCurrentUser: true,
    })
    expect(record).toHaveBeenCalledWith(
      context,
      'role_members_cleared',
      roleId,
      { snapshot, assignmentCount: 2 },
      { snapshot: 'b'.repeat(64), assignmentCount: 0, affectedUserIds: [memberId, context.userId] },
    )
  })

  it('adds only previously unassigned users and treats repeated additions as no-ops', async () => {
    const { manage, store, record } = fixture()
    await expect(
      manage.add(context, roleId, { userIds: [memberId], expectedSnapshot: snapshot }),
    ).resolves.toMatchObject({ affectedCount: 0 })
    expect(store.add).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })
})
