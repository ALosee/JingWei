import type { PasswordHasher, SessionService } from '@jingwei/auth'
import {
  ApplicationError,
  type Clock,
  type RequestId,
  type TenantId,
  type UserId,
} from '@jingwei/kernel'

import type { AccountProfile, UpdateAccountInput } from '../../shared/index.js'

export interface AccountProfileReader {
  findProfile(
    tenantId: TenantId,
    userId: UserId,
  ): Promise<(AccountProfile & { passwordHash: string }) | null>
  listActiveRoles(
    tenantId: TenantId,
    userId: UserId,
  ): Promise<
    {
      code: string
      name: string
      status: 'INVITED' | 'ACTIVE' | 'DISABLED' | 'LOCKED'
    }[]
  >
}

export interface AccountProfileWriter {
  updateProfile(input: {
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly displayName?: string
    readonly avatarUrl?: string | null
    readonly updatedAt: Date
  }): Promise<void>
  updatePassword(input: {
    readonly userId: UserId
    readonly passwordHash: string
    readonly changedAt: Date
  }): Promise<void>
}

/** Reads the authenticated user's own account projection. Never accepts a caller-supplied user id. */
export class ReadAccountProfile {
  constructor(private readonly accounts: AccountProfileReader) {}

  async execute(context: {
    readonly tenantId: TenantId
    readonly userId: UserId
  }): Promise<AccountProfile> {
    const profile = await this.accounts.findProfile(context.tenantId, context.userId)
    if (profile === null) throw accountUnavailable()
    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      status: profile.status,
      lastLoginAt: profile.lastLoginAt,
      createdAt: profile.createdAt,
      passwordChangedAt: profile.passwordChangedAt,
    }
  }
}

export class ReadAccountRoles {
  constructor(private readonly accounts: AccountProfileReader) {}

  execute(context: { readonly tenantId: TenantId; readonly userId: UserId }) {
    return this.accounts.listActiveRoles(context.tenantId, context.userId)
  }
}

export class UpdateAccountProfile {
  constructor(
    private readonly dependencies: {
      readonly accounts: AccountProfileReader & AccountProfileWriter
      readonly clock: Clock
    },
  ) {}

  async execute(
    context: {
      readonly tenantId: TenantId
      readonly userId: UserId
      readonly requestId: RequestId
    },
    input: UpdateAccountInput,
  ): Promise<AccountProfile> {
    const current = await this.dependencies.accounts.findProfile(context.tenantId, context.userId)
    if (current === null) throw accountUnavailable()

    const displayName = input.displayName ?? current.displayName
    const avatarUrl = input.avatarUrl === undefined ? current.avatarUrl : input.avatarUrl
    await this.dependencies.accounts.updateProfile({
      tenantId: context.tenantId,
      userId: context.userId,
      displayName,
      avatarUrl,
      updatedAt: this.dependencies.clock.now(),
    })

    return {
      ...current,
      displayName,
      avatarUrl,
    }
  }
}

/**
 * Changes the current user's password and revokes every session for that user.
 * Callers must redirect to sign-in afterwards; the present session dies with the family.
 */
export class ChangeAccountPassword {
  constructor(
    private readonly dependencies: {
      readonly accounts: AccountProfileReader & AccountProfileWriter
      readonly passwords: PasswordHasher
      readonly sessions: Pick<SessionService, 'revokeUser'>
      readonly clock: Clock
    },
  ) {}

  async execute(
    context: {
      readonly tenantId: TenantId
      readonly userId: UserId
      readonly requestId: RequestId
    },
    input: { readonly currentPassword: string; readonly newPassword: string },
  ): Promise<void> {
    const profile = await this.dependencies.accounts.findProfile(context.tenantId, context.userId)
    if (profile === null) throw accountUnavailable()
    if (profile.status !== 'ACTIVE') throw accountUnavailable()

    const verified = await this.dependencies.passwords.verify(
      profile.passwordHash,
      input.currentPassword,
    )
    if (!verified) {
      throw new ApplicationError({
        code: 'CURRENT_PASSWORD_INVALID',
        message: '当前密码不正确',
        status: 400,
      })
    }

    const passwordHash = await this.dependencies.passwords.hash(input.newPassword)
    const changedAt = this.dependencies.clock.now()
    await this.dependencies.accounts.updatePassword({
      userId: context.userId,
      passwordHash,
      changedAt,
    })
    await this.dependencies.sessions.revokeUser(context.tenantId, context.userId)
  }
}

function accountUnavailable(): ApplicationError {
  return new ApplicationError({
    code: 'ACCOUNT_UNAVAILABLE',
    message: '账号不可用',
    status: 404,
  })
}
