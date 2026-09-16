import type { PasswordHasher, SessionService } from '@jingwei/auth'
import {
  ApplicationError,
  newUserId,
  toUserId,
  type AuthContext,
  type Clock,
} from '@jingwei/kernel'

import type {
  CreateManagedUser,
  ManagedUser,
  ReplaceUserRoles,
  ResetManagedUserPassword,
  UpdateManagedUser,
  UserRoleList,
} from '../../shared/index.js'
import type { IamAccess } from '../public/navigation-access.js'
import type { UserAdminStore, UserAdminUnitOfWork } from './user-admin-store.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

function normalizeLogin(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.toLocaleLowerCase('en-US')
}

/** Tenant-scoped user administration; never confuses this with HR employee records. */
export class ManageIamUsers {
  constructor(
    private readonly store: UserAdminStore,
    private readonly work: UserAdminUnitOfWork,
    private readonly access: IamAccess,
    private readonly passwords: PasswordHasher,
    private readonly sessions: Pick<SessionService, 'revokeUser'>,
    private readonly clock: Clock,
  ) {}

  private authorize(context: AuthContext, action: 'view' | 'manage') {
    return this.access.requireUnscopedPermission(
      context,
      'iam.user.' + action,
      'iam.authentication',
    )
  }

  async list(context: AuthContext) {
    await this.authorize(context, 'view')
    return { users: await this.store.list(context.tenantId) }
  }

  async get(context: AuthContext, id: string): Promise<ManagedUser> {
    await this.authorize(context, 'view')
    const user = await this.store.get(context.tenantId, id)
    if (user === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
    return user
  }

  async create(context: AuthContext, input: CreateManagedUser): Promise<ManagedUser> {
    await this.authorize(context, 'manage')
    const usernameNormalized = normalizeLogin(input.username)
    const emailNormalized = normalizeEmail(input.email)
    return this.work.run(async (tx) => {
      if (await tx.store.usernameTaken(context.tenantId, usernameNormalized))
        fail('IAM_USER_USERNAME_CONFLICT', '用户名在租户内已存在')
      if (
        emailNormalized !== null &&
        (await tx.store.emailTaken(context.tenantId, emailNormalized))
      )
        fail('IAM_USER_EMAIL_CONFLICT', '邮箱在租户内已存在')
      const roleIds = input.roleIds ?? []
      if (roleIds.length > 0 && !(await tx.store.rolesExist(context.tenantId, roleIds)))
        fail('IAM_ROLE_NOT_FOUND', '指定角色不存在或不可用', 400)

      const now = this.clock.now()
      const userId = newUserId()
      const passwordHash = await this.passwords.hash(input.password)
      await tx.store.insertUser(context, {
        id: userId,
        username: input.username.trim(),
        usernameNormalized,
        displayName: input.displayName.trim(),
        email: input.email?.trim() ?? null,
        emailNormalized,
        phone: input.phone?.trim() ?? null,
        passwordHash,
        passwordChangedAt: now,
        status: 'ACTIVE',
      })
      if (roleIds.length > 0) await tx.store.replaceUserRoles(context, userId, roleIds)
      const created = await tx.store.get(context.tenantId, userId)
      if (created === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
      await tx.record(context, 'user_created', userId, null, {
        username: created.username,
        displayName: created.displayName,
        status: created.status,
        roleIds,
      })
      return created
    })
  }

  async update(context: AuthContext, id: string, input: UpdateManagedUser): Promise<ManagedUser> {
    await this.authorize(context, 'manage')
    const emailNormalized = input.email === undefined ? undefined : normalizeEmail(input.email)
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
      if (id === context.userId && input.status === 'DISABLED')
        fail('IAM_USER_CANNOT_DISABLE_SELF', '不能禁用当前登录账号')
      if (
        emailNormalized !== undefined &&
        emailNormalized !== null &&
        (await tx.store.emailTaken(context.tenantId, emailNormalized, id))
      )
        fail('IAM_USER_EMAIL_CONFLICT', '邮箱在租户内已存在')

      if (
        input.status === 'DISABLED' &&
        existing.status === 'ACTIVE' &&
        (await tx.store.userHasActiveManagePermission(context.tenantId, id))
      ) {
        if ((await tx.store.countOtherActiveManagers(context.tenantId, id)) === 0)
          fail(
            'IAM_USER_LAST_MANAGER',
            '不能禁用最后一个具备用户管理权限的账号，请先授权其他管理员',
          )
      }

      await tx.store.updateUser(context, id, {
        ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
        ...(input.email === undefined
          ? {}
          : { email: input.email === null ? null : input.email.trim() }),
        ...(emailNormalized === undefined ? {} : { emailNormalized }),
        ...(input.phone === undefined
          ? {}
          : { phone: input.phone === null ? null : input.phone.trim() }),
        ...(input.status === undefined ? {} : { status: input.status }),
      })
      const updated = await tx.store.get(context.tenantId, id)
      if (updated === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
      await tx.record(context, 'user_updated', id, existing, updated)
      if (input.status === 'DISABLED' && existing.status !== 'DISABLED') {
        await this.sessions.revokeUser(context.tenantId, toUserId(id))
      }
      return updated
    })
  }

  async resetPassword(
    context: AuthContext,
    id: string,
    input: ResetManagedUserPassword,
  ): Promise<void> {
    await this.authorize(context, 'manage')
    await this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
      if (existing.status === 'DISABLED') fail('IAM_USER_DISABLED', '账号已禁用，无法重置密码')
      const passwordHash = await this.passwords.hash(input.newPassword)
      await tx.store.updateUserPassword(context, id, passwordHash, this.clock.now())
      await tx.record(context, 'user_password_reset', id, null, { userId: id })
    })
    await this.sessions.revokeUser(context.tenantId, toUserId(id))
  }

  async listRoles(context: AuthContext, id: string): Promise<UserRoleList> {
    await this.authorize(context, 'view')
    const user = await this.store.get(context.tenantId, id)
    if (user === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
    return { roles: await this.store.listUserRoles(context.tenantId, id) }
  }

  async replaceRoles(
    context: AuthContext,
    id: string,
    input: ReplaceUserRoles,
  ): Promise<UserRoleList> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await tx.store.get(context.tenantId, id)
      if (existing === null) fail('IAM_USER_NOT_FOUND', '用户不存在', 404)
      const roleIds = [...new Set(input.roleIds)]
      if (roleIds.length > 0 && !(await tx.store.rolesExist(context.tenantId, roleIds)))
        fail('IAM_ROLE_NOT_FOUND', '指定角色不存在或不可用', 400)

      if (
        existing.status === 'ACTIVE' &&
        id !== context.userId &&
        (await tx.store.userHasActiveManagePermission(context.tenantId, id))
      ) {
        const stillManager =
          roleIds.length > 0 &&
          (await tx.store.rolesIncludeManagePermission(context.tenantId, roleIds))
        if (!stillManager && (await tx.store.countOtherActiveManagers(context.tenantId, id)) === 0)
          fail(
            'IAM_USER_LAST_MANAGER',
            '不能移除最后一个具备用户管理权限账号的管理角色，请先授权其他管理员',
          )
      }

      await tx.store.replaceUserRoles(context, id, roleIds)
      const roles = await tx.store.listUserRoles(context.tenantId, id)
      await tx.record(context, 'user_roles_replaced', id, null, { roleIds })
      return { roles }
    })
  }
}
