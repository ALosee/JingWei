import { ApplicationError, type UserId } from '@jingwei/kernel'
import type { PasswordHasher, SessionService } from '@jingwei/auth'
import type { TenantDirectory } from '@jingwei/database'

import type { LoginInput } from '../../shared/index.js'
import type { UserStatus } from '../domain/user-status.js'

export interface CredentialSnapshot {
  readonly userId: UserId
  readonly displayName: string
  readonly status: UserStatus
  readonly passwordHash: string
}

/** Private IAM read port; callers receive only the fields required to authenticate one login. */
export interface CredentialReader {
  findByLogin(tenantId: string, normalizedLogin: string): Promise<CredentialSnapshot | null>
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
      readonly credentials: CredentialReader
      readonly passwords: PasswordHasher
      readonly sessions: SessionService
    },
  ) {}

  async execute(
    input: LoginInput,
    request: { readonly userAgent?: string; readonly ipAddress?: string },
  ) {
    const tenant = await this.dependencies.tenants.findActiveByCode(input.tenantCode)
    if (tenant === null) throw authenticationFailed()

    const credential = await this.dependencies.credentials.findByLogin(
      tenant.id,
      normalizeLogin(input.login),
    )
    if (credential?.status !== 'ACTIVE') throw authenticationFailed()

    const verified = await this.dependencies.passwords.verify(
      credential.passwordHash,
      input.password,
    )
    if (!verified) throw authenticationFailed()

    const session = await this.dependencies.sessions.create({
      tenantId: tenant.id,
      userId: credential.userId,
      ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
      ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
    })

    return {
      session,
      user: {
        id: credential.userId,
        tenantId: tenant.id,
        displayName: credential.displayName,
      },
    }
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
