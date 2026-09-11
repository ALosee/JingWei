import type { PasswordHasher, SessionService } from '@jingwei/auth'
import type { TenantDirectory } from '@jingwei/database'
import {
  ApplicationError,
  type Clock,
  type RequestId,
  type SessionId,
  type TenantId,
  type UserId,
} from '@jingwei/kernel'

import type { LoginInput } from '../../shared/index.js'
import type { UserStatus } from '../domain/user-status.js'

export interface CredentialSnapshot {
  readonly userId: UserId
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly status: UserStatus
  readonly passwordHash: string
  readonly lockedUntil: Date | null
}

/** Private IAM credential port; callers receive and mutate only login-security state. */
export interface CredentialStore {
  findByLogin(tenantId: string, normalizedLogin: string): Promise<CredentialSnapshot | null>
  recordFailure(input: {
    readonly userId: UserId
    readonly occurredAt: Date
    readonly maxFailedAttempts: number
    readonly lockSeconds: number
  }): Promise<void>
}

export interface AuthenticationTransaction {
  completeLogin(input: {
    readonly requestId: RequestId
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly sessionId: SessionId
    readonly occurredAt: Date
    readonly ipAddress?: string
    readonly userAgent?: string
  }): Promise<void>
}

/** Application-owned boundary for the credential, user, and login-audit transaction. */
export interface AuthenticationUnitOfWork {
  run<T>(work: (transaction: AuthenticationTransaction) => Promise<T>): Promise<T>
}

/**
 * Tenant-aware password authentication use case.
 *
 * Every tenant/user/status/password failure is intentionally collapsed to the same external error
 * to resist account enumeration. The returned raw session secrets must go directly to secure
 * cookies and must never be logged, audited, or published in an event.
 */
export class AuthenticateUser {
  constructor(
    private readonly dependencies: {
      readonly tenants: TenantDirectory
      readonly credentials: CredentialStore
      readonly unitOfWork: AuthenticationUnitOfWork
      readonly passwords: PasswordHasher
      readonly sessions: Pick<SessionService, 'create' | 'revoke'>
      readonly clock: Clock
      readonly dummyPasswordHash: string
      readonly policy: {
        readonly maxFailedAttempts: number
        readonly lockSeconds: number
      }
    },
  ) {}

  async execute(
    input: LoginInput,
    request: {
      readonly requestId: RequestId
      readonly userAgent?: string
      readonly ipAddress?: string
    },
  ) {
    const tenant = await this.dependencies.tenants.findActiveByCode(input.tenantCode)
    if (tenant === null) {
      await this.verifyUnknownCredential(input.password)
      throw authenticationFailed()
    }

    const credential = await this.dependencies.credentials.findByLogin(
      tenant.id,
      normalizeLogin(input.login),
    )
    if (credential === null) {
      await this.verifyUnknownCredential(input.password)
      throw authenticationFailed()
    }

    const verified = await this.dependencies.passwords.verify(
      credential.passwordHash,
      input.password,
    )
    const now = this.dependencies.clock.now()
    const locked = credential.lockedUntil !== null && credential.lockedUntil > now
    if (credential.status !== 'ACTIVE' || locked) throw authenticationFailed()

    if (!verified) {
      await this.dependencies.credentials.recordFailure({
        userId: credential.userId,
        occurredAt: now,
        maxFailedAttempts: this.dependencies.policy.maxFailedAttempts,
        lockSeconds: this.dependencies.policy.lockSeconds,
      })
      throw authenticationFailed()
    }

    const session = await this.dependencies.sessions.create({
      tenantId: tenant.id,
      userId: credential.userId,
      ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
      ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
    })
    try {
      await this.dependencies.unitOfWork.run((transaction) =>
        transaction.completeLogin({
          requestId: request.requestId,
          tenantId: tenant.id,
          userId: credential.userId,
          sessionId: session.id,
          occurredAt: now,
          ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
          ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
        }),
      )
    } catch (error) {
      await this.dependencies.sessions
        .revoke(session.id, 'LOGIN_FINALIZATION_FAILED')
        .catch(() => undefined)
      throw error
    }

    return {
      session,
      user: {
        id: credential.userId,
        tenantId: tenant.id,
        displayName: credential.displayName,
        avatarUrl: credential.avatarUrl,
      },
    }
  }

  private async verifyUnknownCredential(password: string): Promise<void> {
    await this.dependencies.passwords.verify(this.dependencies.dummyPasswordHash, password)
  }
}

function normalizeLogin(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function authenticationFailed(): ApplicationError {
  return new ApplicationError({
    code: 'AUTHENTICATION_FAILED',
    message: '租户、账号或密码不正确',
    status: 401,
  })
}
