import { describe, expect, it } from 'vitest'

import type { PasswordHasher, SessionService } from '@jingwei/auth'
import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  systemClock,
  type ApplicationContext,
  type AuthContext,
  type TenantId,
} from '@jingwei/kernel'

import type {
  CreateManagedUser,
  ManagedUser,
  UpdateManagedUser,
  UserRoleAssignment,
} from '../../shared/index.js'
import type { IamAccess } from '../public/navigation-access.js'
import { ManageIamUsers } from './manage-users.js'
import type {
  UserAdminStore,
  UserAdminTransaction,
  UserAdminUnitOfWork,
} from './user-admin-store.js'

const context: AuthContext = {
  requestId: newRequestId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  sessionId: newSessionId(),
  roleIds: [],
}

const adminRoleId = newUserId()
const viewerRoleId = newUserId()

class MemoryUserStore implements UserAdminStore {
  users = new Map<
    string,
    ManagedUser & {
      usernameNormalized: string
      emailNormalized: string | null
      passwordHash: string
    }
  >()
  userRoles = new Map<string, string[]>()
  roles = new Map<
    string,
    { id: string; code: string; name: string; status: 'ACTIVE' | 'DISABLED'; grantsManage: boolean }
  >([
    [
      adminRoleId,
      { id: adminRoleId, code: 'admin', name: '管理员', status: 'ACTIVE', grantsManage: true },
    ],
    [
      viewerRoleId,
      { id: viewerRoleId, code: 'viewer', name: '只读', status: 'ACTIVE', grantsManage: false },
    ],
  ])

  list() {
    return Promise.resolve([...this.users.values()].map(stripInternal))
  }
  get(_tenantId: string, id: string) {
    const user = this.users.get(id)
    return Promise.resolve(user === undefined ? null : stripInternal(user))
  }
  usernameTaken(_tenantId: string, usernameNormalized: string) {
    for (const user of this.users.values()) {
      if (user.usernameNormalized === usernameNormalized) return Promise.resolve(true)
    }
    return Promise.resolve(false)
  }
  emailTaken(_tenantId: string, emailNormalized: string, exceptUserId?: string) {
    for (const user of this.users.values()) {
      if (user.emailNormalized === emailNormalized && user.id !== exceptUserId)
        return Promise.resolve(true)
    }
    return Promise.resolve(false)
  }
  private isManager(userId: string): boolean {
    const roleIds = this.userRoles.get(userId) ?? []
    const user = this.users.get(userId)
    if (user?.status !== 'ACTIVE') return false
    return roleIds.some((roleId) => this.roles.get(roleId)?.grantsManage === true)
  }
  countOtherActiveManagers(_tenantId: TenantId, exceptUserId: string) {
    let count = 0
    for (const id of this.users.keys()) {
      if (id !== exceptUserId && this.isManager(id)) count += 1
    }
    return Promise.resolve(count)
  }
  userHasActiveManagePermission(_tenantId: string, userId: string) {
    return Promise.resolve(this.isManager(userId))
  }
  rolesIncludeManagePermission(_tenantId: string, roleIds: readonly string[]) {
    return Promise.resolve(roleIds.some((roleId) => this.roles.get(roleId)?.grantsManage === true))
  }
  rolesExist(_tenantId: string, roleIds: readonly string[]) {
    return Promise.resolve(roleIds.every((roleId) => this.roles.get(roleId)?.status === 'ACTIVE'))
  }
  listUserRoles(_tenantId: string, userId: string): Promise<UserRoleAssignment[]> {
    return Promise.resolve(
      (this.userRoles.get(userId) ?? []).flatMap((roleId) => {
        const role = this.roles.get(roleId)
        return role === undefined
          ? []
          : [{ id: role.id, code: role.code, name: role.name, status: role.status }]
      }),
    )
  }
  insertUser(
    _context: ApplicationContext,
    input: {
      id: string
      username: string
      usernameNormalized: string
      displayName: string
      email: string | null
      emailNormalized: string | null
      phone: string | null
      passwordHash: string
      passwordChangedAt: Date
      status: 'ACTIVE' | 'INVITED'
    },
  ) {
    this.users.set(input.id, {
      id: input.id,
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      status: input.status,
      lastLoginAt: null,
      createdAt: input.passwordChangedAt.toISOString(),
      roleCount: 0,
      usernameNormalized: input.usernameNormalized,
      emailNormalized: input.emailNormalized,
      passwordHash: input.passwordHash,
    })
    return Promise.resolve()
  }
  updateUser(
    _context: ApplicationContext,
    id: string,
    patch: UpdateManagedUser & { emailNormalized?: string | null },
  ) {
    const user = this.users.get(id)
    if (user === undefined) return Promise.resolve()
    this.users.set(id, {
      ...user,
      ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
      ...(patch.email === undefined ? {} : { email: patch.email }),
      ...(patch.phone === undefined ? {} : { phone: patch.phone }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.emailNormalized === undefined ? {} : { emailNormalized: patch.emailNormalized }),
    })
    return Promise.resolve()
  }
  updateUserPassword() {
    return Promise.resolve()
  }
  replaceUserRoles(_context: ApplicationContext, userId: string, roleIds: readonly string[]) {
    this.userRoles.set(userId, [...roleIds])
    const user = this.users.get(userId)
    if (user !== undefined) this.users.set(userId, { ...user, roleCount: roleIds.length })
    return Promise.resolve()
  }
}

function stripInternal(user: ManagedUser & Record<string, unknown>): ManagedUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roleCount: user.roleCount,
  }
}

function createManage(store: MemoryUserStore) {
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    requirePermission: () => Promise.resolve(),
  }
  const work: UserAdminUnitOfWork = {
    run<T>(work: (transaction: UserAdminTransaction) => Promise<T>) {
      return work({ store, record: () => Promise.resolve() })
    },
  }
  const passwords: PasswordHasher = {
    hash: (password: string) => Promise.resolve(`hash:${password}`),
    verify: () => Promise.resolve(true),
  }
  const revoked: string[] = []
  const sessions = {
    revokeUser: (_tenantId: string, userId: string) => {
      revoked.push(userId)
      return Promise.resolve()
    },
  } as Pick<SessionService, 'revokeUser'>
  const manage = new ManageIamUsers(store, work, access, passwords, sessions, systemClock)
  return { manage, revoked }
}

describe('ManageIamUsers', () => {
  it('creates a tenant user with normalized username and optional roles', async () => {
    const store = new MemoryUserStore()
    const { manage } = createManage(store)
    const input: CreateManagedUser = {
      username: 'Alice',
      displayName: '爱丽丝',
      email: 'Alice@Example.com',
      password: 'password-1',
      roleIds: [viewerRoleId],
    }
    const created = await manage.create(context, input)
    expect(created.username).toBe('Alice')
    expect(created.email).toBe('Alice@Example.com')
    expect(created.status).toBe('ACTIVE')
    await expect(manage.create(context, input)).rejects.toMatchObject({
      code: 'IAM_USER_USERNAME_CONFLICT',
    })
  })

  it('revokes sessions when disabling and blocks self-disable', async () => {
    const store = new MemoryUserStore()
    const { manage, revoked } = createManage(store)
    const admin = await manage.create(context, {
      username: 'admin',
      displayName: '管理员',
      password: 'password-1',
      roleIds: [adminRoleId],
    })
    const member = await manage.create(context, {
      username: 'member',
      displayName: '成员',
      password: 'password-1',
    })

    await expect(manage.update(context, admin.id, { status: 'DISABLED' })).rejects.toMatchObject({
      code: 'IAM_USER_LAST_MANAGER',
    })

    store.users.set(context.userId, {
      id: context.userId,
      username: 'self',
      displayName: '自己',
      email: null,
      phone: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      roleCount: 1,
      usernameNormalized: 'self',
      emailNormalized: null,
      passwordHash: 'hash:self',
    })
    store.userRoles.set(context.userId, [adminRoleId])
    await expect(
      manage.update(context, context.userId, { status: 'DISABLED' }),
    ).rejects.toMatchObject({
      code: 'IAM_USER_CANNOT_DISABLE_SELF',
    })

    const updated = await manage.update(context, member.id, { status: 'DISABLED' })
    expect(updated.status).toBe('DISABLED')
    expect(revoked).toContain(member.id)
  })

  it('replaces roles and keeps last manager intact', async () => {
    const store = new MemoryUserStore()
    const { manage } = createManage(store)
    const admin = await manage.create(context, {
      username: 'admin',
      displayName: '管理员',
      password: 'password-1',
      roleIds: [adminRoleId],
    })
    await expect(
      manage.replaceRoles(context, admin.id, { roleIds: [viewerRoleId] }),
    ).rejects.toMatchObject({
      code: 'IAM_USER_LAST_MANAGER',
    })
    const result = await manage.replaceRoles(context, admin.id, {
      roleIds: [adminRoleId, viewerRoleId],
    })
    expect(result.roles.map((role) => role.code).sort()).toEqual(['admin', 'viewer'])
  })

  it('rejects unknown roles on create', async () => {
    const store = new MemoryUserStore()
    const { manage } = createManage(store)
    await expect(
      manage.create(context, {
        username: 'bob',
        displayName: 'Bob',
        password: 'password-1',
        roleIds: [newUserId()],
      }),
    ).rejects.toMatchObject({ code: 'IAM_ROLE_NOT_FOUND' })
  })
})
