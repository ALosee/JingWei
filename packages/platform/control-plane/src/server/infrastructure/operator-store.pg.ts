import { sql, type Kysely } from 'kysely'

import { PostgresPlatformAuditWriter } from '@jingwei/audit'
import { ApplicationError, toOperatorId, type OperatorId } from '@jingwei/kernel'

import type { PlatformOperator } from '../../shared/index.js'
import type { BootstrapOperatorStore } from '../application/bootstrap-operator.js'
import type {
  OperatorCredentialSnapshot,
  OperatorCredentialStore,
} from '../application/operator-auth.js'
import type { ActiveOperatorGate } from '../operator-session.js'
import type { ControlPlaneDatabase } from './database.js'

export class PostgresOperatorStore
  implements OperatorCredentialStore, BootstrapOperatorStore, ActiveOperatorGate
{
  constructor(private readonly database: Kysely<ControlPlaneDatabase>) {}

  async findByLogin(normalizedLogin: string): Promise<OperatorCredentialSnapshot | null> {
    const row = await this.database
      .selectFrom('control_plane.operator as operator')
      .innerJoin(
        'control_plane.operator_credential as credential',
        'credential.operator_id',
        'operator.id',
      )
      .select([
        'operator.id',
        'operator.login',
        'operator.display_name',
        'operator.status',
        'credential.password_hash',
        'credential.locked_until',
      ])
      .where('operator.login_normalized', '=', normalizedLogin)
      .executeTakeFirst()
    return row === undefined
      ? null
      : {
          id: toOperatorId(row.id),
          login: row.login,
          displayName: row.display_name,
          status: row.status,
          passwordHash: row.password_hash,
          lockedUntil: row.locked_until,
        }
  }

  async recordFailure(
    context: Parameters<OperatorCredentialStore['recordFailure']>[0],
    input: Parameters<OperatorCredentialStore['recordFailure']>[1],
  ): Promise<void> {
    const nextAttempts = sql<number>`case
      when locked_until is not null and locked_until <= ${input.occurredAt} then 1
      else failed_attempts + 1
    end`
    const lockUntil = new Date(input.occurredAt.getTime() + input.lockSeconds * 1_000)
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('control_plane.operator_credential')
        .set({
          failed_attempts: nextAttempts,
          locked_until: sql<Date | null>`case
            when ${nextAttempts} >= ${input.maxFailedAttempts} then ${lockUntil}::timestamptz
            else null::timestamptz
          end`,
          updated_at: input.occurredAt,
        })
        .where('operator_id', '=', input.operatorId)
        .executeTakeFirstOrThrow()
      await appendLoginFailure(
        transaction,
        context,
        input.operatorId,
        'INVALID_CREDENTIALS',
        input.occurredAt,
      )
    })
  }

  async recordRejectedLogin(
    context: Parameters<OperatorCredentialStore['recordRejectedLogin']>[0],
    input: Parameters<OperatorCredentialStore['recordRejectedLogin']>[1],
  ): Promise<void> {
    await appendLoginFailure(this.database, context, input.entityId, input.reason, input.occurredAt)
  }

  async completeLogin(
    context: Parameters<OperatorCredentialStore['completeLogin']>[0],
    operatorId: OperatorId,
    occurredAt: Date,
  ): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('control_plane.operator_credential')
        .set({ failed_attempts: 0, locked_until: null, updated_at: occurredAt })
        .where('operator_id', '=', operatorId)
        .executeTakeFirstOrThrow()
      await transaction
        .updateTable('control_plane.operator')
        .set({ last_login_at: occurredAt, updated_at: occurredAt })
        .where('id', '=', operatorId)
        .executeTakeFirstOrThrow()
      await new PostgresPlatformAuditWriter(transaction, () => occurredAt).appendPlatform({
        context,
        tenantId: null,
        module: 'control-plane',
        action: 'operator.logged_in',
        entityType: 'platform_operator',
        entityId: operatorId,
        result: 'SUCCESS',
      })
    })
  }

  async findActiveById(operatorId: OperatorId): Promise<PlatformOperator | null> {
    const row = await this.database
      .selectFrom('control_plane.operator')
      .select(['id', 'login', 'display_name'])
      .where('id', '=', operatorId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()
    return row === undefined
      ? null
      : { id: toOperatorId(row.id), login: row.login, displayName: row.display_name }
  }

  async isActive(operatorId: OperatorId): Promise<boolean> {
    return (await this.findActiveById(operatorId)) !== null
  }

  createInitial(
    input: Parameters<BootstrapOperatorStore['createInitial']>[0],
  ): Promise<PlatformOperator> {
    return this.database.transaction().execute(async (transaction) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('jingwei.control-plane.operator-bootstrap'))`.execute(
        transaction,
      )
      const existing = await transaction
        .selectFrom('control_plane.operator')
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow()
      if (Number(existing.count) !== 0) {
        throw new ApplicationError({
          code: 'PLATFORM_OPERATOR_ALREADY_BOOTSTRAPPED',
          message: '平台管理员已经完成初始化',
          status: 409,
        })
      }
      await transaction
        .insertInto('control_plane.operator')
        .values({
          id: input.id,
          login: input.login,
          login_normalized: input.normalizedLogin,
          display_name: input.displayName,
          status: 'ACTIVE',
          last_login_at: null,
          created_at: input.now,
          updated_at: input.now,
        })
        .executeTakeFirstOrThrow()
      await transaction
        .insertInto('control_plane.operator_credential')
        .values({
          operator_id: input.id,
          password_hash: input.passwordHash,
          failed_attempts: 0,
          locked_until: null,
          password_changed_at: input.now,
          created_at: input.now,
          updated_at: input.now,
        })
        .executeTakeFirstOrThrow()
      await new PostgresPlatformAuditWriter(transaction, () => input.now).appendPlatform({
        context: input.context,
        tenantId: null,
        module: 'control-plane',
        action: 'operator.bootstrapped',
        entityType: 'platform_operator',
        entityId: input.id,
        result: 'SUCCESS',
        after: { login: input.login, displayName: input.displayName },
      })
      return { id: input.id, login: input.login, displayName: input.displayName }
    })
  }
}

async function appendLoginFailure(
  database: Kysely<ControlPlaneDatabase>,
  context: Parameters<OperatorCredentialStore['recordRejectedLogin']>[0],
  entityId: string,
  reason: string,
  occurredAt: Date,
): Promise<void> {
  await new PostgresPlatformAuditWriter(database, () => occurredAt).appendPlatform({
    context,
    tenantId: null,
    module: 'control-plane',
    action: 'operator.login_failed',
    entityType: 'platform_operator_login',
    entityId,
    result: 'FAILURE',
    after: { reason },
  })
}
