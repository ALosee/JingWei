import { describe, expect, it } from 'vitest'

import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
} from '@jingwei/kernel'
import type {
  AuthorizationEvaluator,
  IamAccess,
  IamUserDirectory,
  IamUserSafeProfile,
} from '@jingwei/module-iam/server/public'

import { ManageOrganizationMembers } from './manage-org-members.js'
import type {
  MembershipStore,
  MembershipTransaction,
  MembershipUnitOfWork,
  OrganizationMemberPositionRecord,
  OrganizationMemberRecord,
} from './membership-store.js'

const context: AuthContext = {
  requestId: newRequestId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  sessionId: newSessionId(),
  roleIds: [],
}

class MemoryMembershipStore implements MembershipStore {
  units = new Map<string, 'ENABLED' | 'DISABLED'>()
  members = new Map<string, OrganizationMemberRecord>()
  positions = new Map<
    string,
    { orgUnitId: string; code: string; name: string; status: 'ENABLED' | 'DISABLED' }
  >()
  assignments = new Map<string, OrganizationMemberPositionRecord>()

  private memberKey(orgUnitId: string, userId: string) {
    return `${orgUnitId}:${userId}`
  }

  private assignmentKey(userId: string, positionId: string) {
    return `${userId}:${positionId}`
  }

  unitExists(_tenantId: string, orgUnitId: string) {
    return Promise.resolve(this.units.has(orgUnitId))
  }
  unitStatus(_tenantId: string, orgUnitId: string) {
    return Promise.resolve(this.units.get(orgUnitId) ?? null)
  }
  memberExists(_tenantId: string, orgUnitId: string, userId: string) {
    return Promise.resolve(this.members.has(this.memberKey(orgUnitId, userId)))
  }
  getMember(_tenantId: string, orgUnitId: string, userId: string) {
    return Promise.resolve(this.members.get(this.memberKey(orgUnitId, userId)) ?? null)
  }
  listMembers(_tenantId: string, orgUnitId: string) {
    return Promise.resolve(
      [...this.members.values()].filter((member) => member.orgUnitId === orgUnitId),
    )
  }
  listMemberPositionsInUnit(_tenantId: string, orgUnitId: string) {
    return Promise.resolve(
      [...this.assignments.values()].filter((item) => {
        const position = this.positions.get(item.positionId)
        return position?.orgUnitId === orgUnitId
      }),
    )
  }
  listUserPositionsInUnit(_tenantId: string, orgUnitId: string, userId: string) {
    return Promise.resolve(
      [...this.assignments.values()].filter((item) => {
        const position = this.positions.get(item.positionId)
        return item.userId === userId && position?.orgUnitId === orgUnitId
      }),
    )
  }
  enabledPositionIdsInUnit(_tenantId: string, orgUnitId: string, positionIds: readonly string[]) {
    const result = new Set<string>()
    for (const positionId of positionIds) {
      const position = this.positions.get(positionId)
      if (position?.orgUnitId === orgUnitId && position.status === 'ENABLED') result.add(positionId)
    }
    return Promise.resolve(result)
  }
  insertMember(_context: ApplicationContext, record: OrganizationMemberRecord) {
    this.members.set(this.memberKey(record.orgUnitId, record.userId), record)
    return Promise.resolve()
  }
  updateMember(
    _context: ApplicationContext,
    orgUnitId: string,
    userId: string,
    patch: { isPrimary?: boolean; joinedAt?: string | null },
  ) {
    const existing = this.members.get(this.memberKey(orgUnitId, userId))
    if (existing === undefined) return Promise.resolve()
    this.members.set(this.memberKey(orgUnitId, userId), {
      ...existing,
      ...(patch.isPrimary === undefined ? {} : { isPrimary: patch.isPrimary }),
      ...(patch.joinedAt === undefined ? {} : { joinedAt: patch.joinedAt }),
    })
    return Promise.resolve()
  }
  deleteMember(_context: ApplicationContext, orgUnitId: string, userId: string) {
    this.members.delete(this.memberKey(orgUnitId, userId))
    return Promise.resolve()
  }
  clearOtherPrimaryOrgs(_context: ApplicationContext, userId: string, keepOrgUnitId: string) {
    const demoted: OrganizationMemberRecord[] = []
    for (const [key, member] of this.members) {
      if (member.userId === userId && member.orgUnitId !== keepOrgUnitId && member.isPrimary) {
        const next = { ...member, isPrimary: false }
        this.members.set(key, next)
        demoted.push(next)
      }
    }
    return Promise.resolve(demoted)
  }
  deleteMemberPositionsInUnit(_context: ApplicationContext, orgUnitId: string, userId: string) {
    for (const [key, item] of this.assignments) {
      const position = this.positions.get(item.positionId)
      if (item.userId === userId && position?.orgUnitId === orgUnitId) this.assignments.delete(key)
    }
    return Promise.resolve()
  }
  replaceMemberPositions(
    _context: ApplicationContext,
    orgUnitId: string,
    userId: string,
    assignments: readonly { positionId: string; isPrimary: boolean }[],
  ) {
    for (const [key, item] of this.assignments) {
      const position = this.positions.get(item.positionId)
      if (item.userId === userId && position?.orgUnitId === orgUnitId) this.assignments.delete(key)
    }
    for (const assignment of assignments) {
      const position = this.positions.get(assignment.positionId)
      if (position === undefined) continue
      this.assignments.set(this.assignmentKey(userId, assignment.positionId), {
        userId,
        positionId: assignment.positionId,
        code: position.code,
        name: position.name,
        isPrimary: assignment.isPrimary,
      })
    }
    return Promise.resolve()
  }
  clearOtherPrimaryPositions(
    _context: ApplicationContext,
    userId: string,
    keepPositionIds: readonly string[],
  ) {
    const keep = new Set(keepPositionIds)
    const demoted: { positionId: string; orgUnitId: string }[] = []
    for (const [key, item] of this.assignments) {
      if (item.userId === userId && item.isPrimary && !keep.has(item.positionId)) {
        this.assignments.set(key, { ...item, isPrimary: false })
        demoted.push({
          positionId: item.positionId,
          orgUnitId: this.positions.get(item.positionId)?.orgUnitId ?? '',
        })
      }
    }
    return Promise.resolve(demoted)
  }
  orgUnitIdsOf(_tenantId: string, userId: string) {
    return Promise.resolve(
      [...this.members.values()]
        .filter((member) => member.userId === userId)
        .map((member) => member.orgUnitId),
    )
  }
  primaryOrgUnitIdOf(_tenantId: string, userId: string) {
    const primary = [...this.members.values()].find(
      (member) => member.userId === userId && member.isPrimary,
    )
    return Promise.resolve(primary?.orgUnitId ?? null)
  }
}

function createManage(
  store: MemoryMembershipStore,
  directory?: Partial<IamUserDirectory>,
  evaluator: AuthorizationEvaluator = {
    requireScopedPermission: () =>
      Promise.resolve({ type: 'ALL', organizationIds: [], includeSelf: false }),
  },
) {
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
  }
  const knownUsers = new Set<string>()
  const users: IamUserDirectory = {
    findSafeProfiles: (_tenantId, userIds) => {
      const profiles: IamUserSafeProfile[] = userIds
        .filter((id) => knownUsers.has(id))
        .map((id) => ({
          id,
          username: `user-${id.slice(0, 8)}`,
          displayName: `User ${id.slice(0, 8)}`,
          status: 'ACTIVE' as const,
          avatar: null,
        }))
      return Promise.resolve(profiles)
    },
    usersExist: (_tenantId, userIds) =>
      Promise.resolve(new Set(userIds.filter((id) => knownUsers.has(id)))),
    listSafeProfiles: () =>
      Promise.resolve(
        [...knownUsers].map((id) => ({
          id,
          username: `user-${id.slice(0, 8)}`,
          displayName: `User ${id.slice(0, 8)}`,
          status: 'ACTIVE' as const,
          avatar: null,
        })),
      ),
    ...directory,
  }
  const work: MembershipUnitOfWork = {
    run<T>(callback: (transaction: MembershipTransaction) => Promise<T>) {
      return callback({
        store,
        record: () => Promise.resolve(),
      })
    },
  }
  const manage = new ManageOrganizationMembers(store, work, access, users, evaluator)
  return { manage, knownUsers }
}

describe('ManageOrganizationMembers', () => {
  it('adds a member and hydrates safe user profile', async () => {
    const store = new MemoryMembershipStore()
    const orgUnitId = newUserId()
    const userId = newUserId()
    store.units.set(orgUnitId, 'ENABLED')
    const { manage, knownUsers } = createManage(store)
    knownUsers.add(userId)

    const created = await manage.add(context, orgUnitId, { userId })
    expect(created.userId).toBe(userId)
    expect(created.isPrimary).toBe(false)

    const list = await manage.listByUnit(context, orgUnitId)
    expect(list.members).toHaveLength(1)
    expect(list.members[0]?.user.displayName).toContain('User')
  })

  it('rejects missing user and disabled unit', async () => {
    const store = new MemoryMembershipStore()
    const enabledId = newUserId()
    const disabledId = newUserId()
    store.units.set(enabledId, 'ENABLED')
    store.units.set(disabledId, 'DISABLED')
    const { manage } = createManage(store)

    await expect(manage.add(context, enabledId, { userId: newUserId() })).rejects.toMatchObject({
      code: 'ORGANIZATION_USER_NOT_FOUND',
    })
    await expect(manage.add(context, disabledId, { userId: newUserId() })).rejects.toMatchObject({
      code: 'ORGANIZATION_UNIT_DISABLED',
    })
  })

  it('enforces single primary organization per user', async () => {
    const store = new MemoryMembershipStore()
    const unitA = newUserId()
    const unitB = newUserId()
    const userId = newUserId()
    store.units.set(unitA, 'ENABLED')
    store.units.set(unitB, 'ENABLED')
    const { manage, knownUsers } = createManage(store)
    knownUsers.add(userId)

    await manage.add(context, unitA, { userId, isPrimary: true })
    await manage.add(context, unitB, { userId, isPrimary: true })

    expect(store.members.get(`${unitA}:${userId}`)?.isPrimary).toBe(false)
    expect(store.members.get(`${unitB}:${userId}`)?.isPrimary).toBe(true)
  })

  it('records demoted primary orgs in the membership audit payload', async () => {
    const store = new MemoryMembershipStore()
    const unitA = newUserId()
    const unitB = newUserId()
    const userId = newUserId()
    store.units.set(unitA, 'ENABLED')
    store.units.set(unitB, 'ENABLED')
    const recorded: unknown[] = []
    const access: IamAccess = {
      activeRoleIds: () => Promise.resolve([]),
      roles: () => Promise.resolve([]),
      effectivePermissionCodes: () => Promise.resolve([]),
      requireUnscopedPermission: () => Promise.resolve(),
    }
    const knownUsers = new Set<string>([userId])
    const users: IamUserDirectory = {
      findSafeProfiles: () =>
        Promise.resolve([
          {
            id: userId,
            username: 'u',
            displayName: 'U',
            status: 'ACTIVE' as const,
            avatar: null,
          },
        ]),
      usersExist: (_t, ids) => Promise.resolve(new Set(ids.filter((id) => knownUsers.has(id)))),
      listSafeProfiles: () =>
        Promise.resolve([
          {
            id: userId,
            username: 'u',
            displayName: 'U',
            status: 'ACTIVE' as const,
            avatar: null,
          },
        ]),
    }
    const work: MembershipUnitOfWork = {
      run<T>(callback: (transaction: MembershipTransaction) => Promise<T>) {
        return callback({
          store,
          record: (_c, action, _entityId, _before, after) => {
            if (action === 'member_updated') recorded.push(after)
            return Promise.resolve()
          },
        })
      },
    }
    const manage = new ManageOrganizationMembers(store, work, access, users, {
      requireScopedPermission: () =>
        Promise.resolve({ type: 'ALL', organizationIds: [], includeSelf: false }),
    })
    await manage.add(context, unitA, { userId, isPrimary: true })
    await manage.add(context, unitB, { userId })
    await manage.update(context, unitB, userId, { isPrimary: true })
    expect(recorded.at(-1)).toMatchObject({ orgUnitId: unitB, demotedOrgUnitIds: [unitA] })
  })

  it('rejects duplicate membership', async () => {
    const store = new MemoryMembershipStore()
    const orgUnitId = newUserId()
    const userId = newUserId()
    store.units.set(orgUnitId, 'ENABLED')
    const { manage, knownUsers } = createManage(store)
    knownUsers.add(userId)
    await manage.add(context, orgUnitId, { userId })
    await expect(manage.add(context, orgUnitId, { userId })).rejects.toMatchObject({
      code: 'ORGANIZATION_MEMBER_EXISTS',
    })
  })

  it('assigns only enabled positions of the same unit', async () => {
    const store = new MemoryMembershipStore()
    const orgUnitId = newUserId()
    const otherUnitId = newUserId()
    const userId = newUserId()
    const positionId = newUserId()
    const foreignPositionId = newUserId()
    store.units.set(orgUnitId, 'ENABLED')
    store.units.set(otherUnitId, 'ENABLED')
    store.positions.set(positionId, {
      orgUnitId,
      code: 'P1',
      name: '岗位一',
      status: 'ENABLED',
    })
    store.positions.set(foreignPositionId, {
      orgUnitId: otherUnitId,
      code: 'P2',
      name: '岗位二',
      status: 'ENABLED',
    })
    const { manage, knownUsers } = createManage(store)
    knownUsers.add(userId)

    await manage.add(context, orgUnitId, { userId, positionIds: [positionId] })
    const listed = await manage.listByUnit(context, orgUnitId)
    expect(listed.members[0]?.positions).toEqual([
      { positionId, code: 'P1', name: '岗位一', isPrimary: false },
    ])

    await expect(
      manage.replacePositions(context, orgUnitId, userId, {
        assignments: [{ positionId: foreignPositionId }],
      }),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_POSITION_NOT_IN_UNIT' })
  })

  it('replaces positions and keeps a single primary position', async () => {
    const store = new MemoryMembershipStore()
    const orgUnitId = newUserId()
    const userId = newUserId()
    const positionA = newUserId()
    const positionB = newUserId()
    store.units.set(orgUnitId, 'ENABLED')
    store.positions.set(positionA, { orgUnitId, code: 'A', name: 'A', status: 'ENABLED' })
    store.positions.set(positionB, { orgUnitId, code: 'B', name: 'B', status: 'ENABLED' })
    const { manage, knownUsers } = createManage(store)
    knownUsers.add(userId)
    await manage.add(context, orgUnitId, { userId })

    await manage.replacePositions(context, orgUnitId, userId, {
      assignments: [{ positionId: positionA, isPrimary: true }, { positionId: positionB }],
    })
    expect(store.assignments.get(`${userId}:${positionA}`)?.isPrimary).toBe(true)
    expect(store.assignments.get(`${userId}:${positionB}`)?.isPrimary).toBe(false)

    await expect(
      manage.replacePositions(context, orgUnitId, userId, {
        assignments: [
          { positionId: positionA, isPrimary: true },
          { positionId: positionB, isPrimary: true },
        ],
      }),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_MULTIPLE_PRIMARY_POSITIONS' })
  })

  it('removes member and clears unit positions', async () => {
    const store = new MemoryMembershipStore()
    const orgUnitId = newUserId()
    const userId = newUserId()
    const positionId = newUserId()
    store.units.set(orgUnitId, 'ENABLED')
    store.positions.set(positionId, { orgUnitId, code: 'P', name: 'P', status: 'ENABLED' })
    const { manage, knownUsers } = createManage(store)
    knownUsers.add(userId)
    await manage.add(context, orgUnitId, { userId, positionIds: [positionId] })

    await manage.remove(context, orgUnitId, userId)
    expect(store.members.has(`${orgUnitId}:${userId}`)).toBe(false)
    expect(store.assignments.has(`${userId}:${positionId}`)).toBe(false)
  })

  it('denies listByUnit when the unit is outside data scope', async () => {
    const store = new MemoryMembershipStore()
    const orgUnitId = newUserId()
    store.units.set(orgUnitId, 'ENABLED')
    const { manage } = createManage(store, undefined, {
      requireScopedPermission: () =>
        Promise.resolve({
          type: 'ORGANIZATION',
          organizationIds: ['other-unit'],
          includeSelf: false,
        }),
    })
    await expect(manage.listByUnit(context, orgUnitId)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    })
  })
})
