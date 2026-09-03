import { sql, QueryCreator, type Insertable, type Kysely, type Selectable, type QueryExecutorProvider } from 'kysely'

import { newEntityId, type TenantId } from '@jingwei/kernel'

export interface OutboxTable {
  id: string
  tenant_id: string
  event_type: string
  event_version: number
  aggregate_type: string
  aggregate_id: string
  payload: unknown
  occurred_at: Date
  published_at: Date | null
  attempts: number
  next_attempt_at: Date
  last_error: string | null
  locked_at: Date | null
  locked_by: string | null
}

export interface OutboxDatabase {
  'platform.outbox': OutboxTable
}

/**
 * Versioned fact published across module boundaries.
 * Payloads must be minimal, JSON-serializable, and free of secrets; consumers must be idempotent.
 */
export interface IntegrationEvent<TPayload = unknown> {
  readonly tenantId: TenantId
  readonly type: string
  readonly version: number
  readonly aggregateType: string
  readonly aggregateId: string
  readonly occurredAt: Date
  readonly payload: TPayload
}

/** Appends an event using the caller's executor so it can share the business transaction. */
export class PostgresOutboxAppender {
  async append(
    executor: QueryExecutorProvider,
    event: IntegrationEvent,
  ): Promise<void> {
    const row: Insertable<OutboxTable> = {
      id: newEntityId(),
      tenant_id: event.tenantId,
      event_type: event.type,
      event_version: event.version,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      payload: event.payload,
      occurred_at: event.occurredAt,
      published_at: null,
      attempts: 0,
      next_attempt_at: event.occurredAt,
      last_error: null,
      locked_at: null,
      locked_by: null,
    }

    await new QueryCreator<OutboxDatabase>({ executor: executor.getExecutor() })
      .insertInto('platform.outbox').values(row).executeTakeFirstOrThrow()
  }
}

export type OutboxRow = Selectable<OutboxTable>

export interface OutboxRepository {
  claimBatch(workerId: string, size: number, now: Date): Promise<readonly OutboxRow[]>
  markPublished(id: string, publishedAt: Date): Promise<void>
  markFailed(id: string, error: string, retryAt: Date): Promise<void>
}

/**
 * PostgreSQL outbox repository using short `FOR UPDATE SKIP LOCKED` claim transactions.
 * Expired locks can be reclaimed after a worker crash, so delivery is at-least-once.
 */
export class PostgresOutboxRepository implements OutboxRepository {
  constructor(
    private readonly database: Kysely<OutboxDatabase>,
    private readonly lockSeconds = 60,
  ) {}

  claimBatch(workerId: string, size: number, now: Date): Promise<readonly OutboxRow[]> {
    const staleBefore = new Date(now.getTime() - this.lockSeconds * 1_000)

    return this.database.transaction().execute(async (transaction) => {
      const rows = await transaction
        .selectFrom('platform.outbox')
        .selectAll()
        .where('published_at', 'is', null)
        .where('next_attempt_at', '<=', now)
        .where((expression) =>
          expression.or([
            expression('locked_at', 'is', null),
            expression('locked_at', '<', staleBefore),
          ]),
        )
        .orderBy('occurred_at', 'asc')
        .limit(size)
        .forUpdate()
        .skipLocked()
        .execute()

      if (rows.length === 0) return []

      const ids = rows.map(({ id }) => id)
      await transaction
        .updateTable('platform.outbox')
        .set({
          locked_at: now,
          locked_by: workerId,
          attempts: sql<number>`attempts + 1`,
        })
        .where('id', 'in', ids)
        .execute()

      return rows.map((row) => ({
        ...row,
        attempts: row.attempts + 1,
        locked_at: now,
        locked_by: workerId,
      }))
    })
  }

  async markPublished(id: string, publishedAt: Date): Promise<void> {
    await this.database
      .updateTable('platform.outbox')
      .set({ published_at: publishedAt, locked_at: null, locked_by: null, last_error: null })
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async markFailed(id: string, error: string, retryAt: Date): Promise<void> {
    await this.database
      .updateTable('platform.outbox')
      .set({
        last_error: error.slice(0, 8_000),
        next_attempt_at: retryAt,
        locked_at: null,
        locked_by: null,
      })
      .where('id', '=', id)
      .executeTakeFirst()
  }
}

export interface EventDispatcher {
  dispatch(event: OutboxRow): Promise<void>
}

/**
 * Dispatches one bounded batch and records success or exponential-backoff failure for each row.
 * `runOnce` does not schedule itself; the process composition root owns polling and shutdown.
 */
export class OutboxWorker {
  constructor(
    private readonly workerId: string,
    private readonly repository: OutboxRepository,
    private readonly dispatcher: EventDispatcher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async runOnce(batchSize = 50): Promise<number> {
    const events = await this.repository.claimBatch(this.workerId, batchSize, this.now())

    for (const event of events) {
      try {
        await this.dispatcher.dispatch(event)
        await this.repository.markPublished(event.id, this.now())
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown dispatch error'
        const retryAt = new Date(this.now().getTime() + retryDelay(event.attempts))
        await this.repository.markFailed(event.id, message, retryAt)
      }
    }

    return events.length
  }
}

function retryDelay(attempt: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(attempt, 6))
}
