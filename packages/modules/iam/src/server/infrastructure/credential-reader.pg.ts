import { sql, type Kysely, type Transaction } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import {
  toUserId,
  type RequestId,
  type SessionId,
  type TenantId,
  type UserId,
} from '@jingwei/kernel'

import type {
  AuthenticationTransaction,
  AuthenticationUnitOfWork,
  CredentialSnapshot,
  CredentialStore,
} from '../application/authenticate-user.js'
import type { UserStatus } from '../domain/user-status.js'

interface UserTable {
  id: string
  tenant_id: string
  username_normalized: string
  email_normalized: string | null
  display_name: string
  status: UserStatus
  last_login_at: Date | null
  updated_at: Date
}

interface CredentialTable {
  user_id: string
  password_hash: string
  failed_attempts: number
  locked_until: Date | null
  updated_at: Date
}

export interface IamDatabase {
  'iam.user': UserTable
  'iam.user_credential': CredentialTable
}

export class PostgresCredentialStore implements CredentialStore, AuthenticationUnitOfWork {
  constructor(private readonly database: Kysely<IamDatabase>) {}

  async findByLogin(tenantId: string, normalizedLogin: string): Promise<CredentialSnapshot | null> {
    const row = await this.database
      .selectFrom('iam.user as user')
      .innerJoin('iam.user_credential as credential', 'credential.user_id', 'user.id')
      .select([
        'user.id',
        'user.display_name',
        'user.status',
        'credential.password_hash',
        'credential.locked_until',
      ])
      .where('user.tenant_id', '=', tenantId)
      .where((expression) =>
        expression.or([
          expression('user.username_normalized', '=', normalizedLogin),
          expression('user.email_normalized', '=', normalizedLogin),
        ]),
      )
      .executeTakeFirst()

    return row === undefined
      ? null
      : {
          userId: toUserId(row.id),
          displayName: row.display_name,
          status: row.status,
          passwordHash: row.password_hash,
          lockedUntil: row.locked_until,
        }
  }

  async recordFailure(input: {
    readonly userId: UserId
    readonly occurredAt: Date
    readonly maxFailedAttempts: number
    readonly lockSeconds: number
  }): Promise<void> {
    const nextFailedAttempts = sql<number>`case
      when locked_until is not null and locked_until <= ${input.occurredAt} then 1
      else failed_attempts + 1
    end`
    const lockUntil = new Date(input.occurredAt.getTime() + input.lockSeconds * 1_000)

    await this.database
      .updateTable('iam.user_credential')
      .set({
        failed_attempts: nextFailedAttempts,
        locked_until: sql<Date | null>`case
          when ${nextFailedAttempts} >= ${input.maxFailedAttempts}
            then ${lockUntil}::timestamptz
          else null::timestamptz
        end`,
        updated_at: input.occurredAt,
      })
      .where('user_id', '=', input.userId)
      .executeTakeFirstOrThrow()
  }

  run<T>(work: (transaction: AuthenticationTransaction) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) => work(new PostgresAuthenticationTransaction(transaction)))
  }
}

class PostgresAuthenticationTransaction implements AuthenticationTransaction {
  constructor(private readonly transaction: Transaction<IamDatabase>) {}

  async completeLogin(input: {
    readonly requestId: RequestId
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly sessionId: SessionId
    readonly occurredAt: Date
    readonly ipAddress?: string
    readonly userAgent?: string
  }): Promise<void> {
    await this.transaction
      .updateTable('iam.user_credential')
      .set({ failed_attempts: 0, locked_until: null, updated_at: input.occurredAt })
      .where('user_id', '=', input.userId)
      .executeTakeFirstOrThrow()
    await this.transaction
      .updateTable('iam.user')
      .set({ last_login_at: input.occurredAt, updated_at: input.occurredAt })
      .where('id', '=', input.userId)
      .executeTakeFirstOrThrow()
    await new PostgresAuditWriter(this.transaction, () => input.occurredAt).append({
      context: {
        requestId: input.requestId,
        tenantId: input.tenantId,
        userId: input.userId,
      },
      module: 'iam',
      action: 'authentication.login',
      entityType: 'AUTH_SESSION',
      entityId: input.sessionId,
      result: 'SUCCESS',
      ...(input.ipAddress === undefined ? {} : { ipAddress: input.ipAddress }),
      ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
    })
  }
}
