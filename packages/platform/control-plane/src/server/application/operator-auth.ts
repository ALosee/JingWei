import type { PlatformAuditContext, PlatformAuditWriter } from '@jingwei/audit'
import type { PasswordHasher } from '@jingwei/auth'
import {
  ApplicationError,
  type Clock,
  type OperatorId,
  type PlatformAuthContext,
} from '@jingwei/kernel'

import type { PlatformLoginInput, PlatformOperator } from '../../shared/index.js'
import type { CreatedOperatorSession, OperatorSessionService } from '../operator-session.js'

export interface OperatorSessionIssuer {
  create(options: Parameters<OperatorSessionService['create']>[0]): Promise<CreatedOperatorSession>
  revoke(...parameters: Parameters<OperatorSessionService['revoke']>): Promise<void>
}

export interface OperatorCredentialSnapshot extends Omit<PlatformOperator, 'id'> {
  readonly id: OperatorId
  readonly status: 'ACTIVE' | 'DISABLED'
  readonly passwordHash: string
  readonly lockedUntil: Date | null
}

export interface OperatorCredentialStore {
  findByLogin(normalizedLogin: string): Promise<OperatorCredentialSnapshot | null>
  recordFailure(
    context: PlatformAuditContext,
    input: {
      readonly operatorId: OperatorId
      readonly occurredAt: Date
      readonly maxFailedAttempts: number
      readonly lockSeconds: number
    },
  ): Promise<void>
  recordRejectedLogin(
    context: PlatformAuditContext,
    input: {
      readonly entityId: string
      readonly occurredAt: Date
      readonly reason: 'UNKNOWN_OPERATOR' | 'OPERATOR_UNAVAILABLE'
    },
  ): Promise<void>
  completeLogin(
    context: PlatformAuditContext,
    operatorId: OperatorId,
    occurredAt: Date,
  ): Promise<void>
  findActiveById(operatorId: OperatorId): Promise<PlatformOperator | null>
}

export interface AuthenticatedOperator {
  readonly operator: PlatformOperator
  readonly session: CreatedOperatorSession
}

export class AuthenticateOperator {
  constructor(
    private readonly credentials: OperatorCredentialStore,
    private readonly passwords: PasswordHasher,
    private readonly sessions: OperatorSessionIssuer,
    private readonly clock: Clock,
    private readonly dummyPasswordHash: string,
    private readonly policy: {
      readonly maxFailedAttempts: number
      readonly lockSeconds: number
    },
  ) {}

  async execute(
    input: PlatformLoginInput,
    request: {
      readonly requestId: PlatformAuditContext['requestId']
      userAgent?: string
      ipAddress?: string
    },
  ): Promise<AuthenticatedOperator> {
    const credential = await this.credentials.findByLogin(normalizeLogin(input.login))
    if (credential === null) {
      await this.passwords.verify(this.dummyPasswordHash, input.password)
      await this.credentials.recordRejectedLogin(failedAuditContext(request), {
        entityId: 'unknown-operator',
        occurredAt: this.clock.now(),
        reason: 'UNKNOWN_OPERATOR',
      })
      throw authenticationFailed()
    }
    const now = this.clock.now()
    const verified = await this.passwords.verify(credential.passwordHash, input.password)
    if (
      credential.status !== 'ACTIVE' ||
      (credential.lockedUntil !== null && credential.lockedUntil > now)
    ) {
      await this.credentials.recordRejectedLogin(failedAuditContext(request), {
        entityId: credential.id,
        occurredAt: now,
        reason: 'OPERATOR_UNAVAILABLE',
      })
      throw authenticationFailed()
    }
    if (!verified) {
      await this.credentials.recordFailure(failedAuditContext(request), {
        operatorId: credential.id,
        occurredAt: now,
        ...this.policy,
      })
      throw authenticationFailed()
    }
    const session = await this.sessions.create({
      operatorId: credential.id,
      ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
      ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
    })
    try {
      await this.credentials.completeLogin(
        {
          requestId: request.requestId,
          actor: { type: 'PLATFORM_OPERATOR', id: credential.id },
          ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
          ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
        },
        credential.id,
        now,
      )
    } catch (error) {
      await this.sessions.revoke(session.id, 'LOGIN_FINALIZATION_FAILED').catch(() => undefined)
      throw error
    }
    return {
      operator: {
        id: credential.id,
        login: credential.login,
        displayName: credential.displayName,
      },
      session,
    }
  }
}

export class ReadOperatorSession {
  constructor(private readonly operators: Pick<OperatorCredentialStore, 'findActiveById'>) {}

  async execute(context: PlatformAuthContext) {
    const operator = await this.operators.findActiveById(context.operatorId)
    return operator === null
      ? ({ authenticated: false } as const)
      : ({ authenticated: true, operator } as const)
  }
}

export class OperatorSessionLifecycle {
  constructor(
    private readonly sessions: Pick<OperatorSessionService, 'revoke'>,
    private readonly audit: PlatformAuditWriter,
  ) {}

  async logout(context: PlatformAuthContext): Promise<void> {
    await this.sessions.revoke(context.sessionId)
    await this.audit.appendPlatform({
      context: platformAuditContext(context),
      tenantId: null,
      module: 'control-plane',
      action: 'operator.logged_out',
      entityType: 'platform_session',
      entityId: context.sessionId,
      result: 'SUCCESS',
    })
  }
}

function normalizeLogin(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function platformAuditContext(context: PlatformAuthContext): PlatformAuditContext {
  return {
    requestId: context.requestId,
    actor: { type: 'PLATFORM_OPERATOR', id: context.operatorId },
    ...(context.ipAddress === undefined ? {} : { ipAddress: context.ipAddress }),
    ...(context.userAgent === undefined ? {} : { userAgent: context.userAgent }),
  }
}

function failedAuditContext(request: {
  readonly requestId: PlatformAuditContext['requestId']
  readonly ipAddress?: string
  readonly userAgent?: string
}): PlatformAuditContext {
  return {
    requestId: request.requestId,
    actor: { type: 'SYSTEM', id: 'platform-authentication' },
    ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
    ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
  }
}

function authenticationFailed(): ApplicationError {
  return new ApplicationError({
    code: 'PLATFORM_AUTHENTICATION_FAILED',
    message: '平台管理员账号或密码不正确',
    status: 401,
  })
}
