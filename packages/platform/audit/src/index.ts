import { QueryCreator, type QueryExecutorProvider } from 'kysely'

import { newEntityId, type ApplicationContext } from '@jingwei/kernel'

interface AuditLogTable {
  id: string
  tenant_id: string
  request_id: string
  actor_user_id: string
  module: string
  action: string
  entity_type: string
  entity_id: string
  result: 'SUCCESS' | 'FAILURE'
  before_data: unknown
  after_data: unknown
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

interface AuditDatabase {
  'platform.audit_log': AuditLogTable
}

/**
 * Append-only description of a security- or business-relevant action.
 * `before` and `after` must be deliberately minimized and stripped of credentials and secrets.
 */
export interface AuditEntry {
  readonly context: ApplicationContext
  readonly module: string
  readonly action: string
  readonly entityType: string
  readonly entityId: string
  readonly result: 'SUCCESS' | 'FAILURE'
  readonly before?: unknown
  readonly after?: unknown
  readonly ipAddress?: string
  readonly userAgent?: string
}

/** Audit append port; critical writes should use an implementation scoped to the business transaction. */
export interface AuditWriter {
  append(entry: AuditEntry): Promise<void>
}

export class PostgresAuditWriter implements AuditWriter {
  private readonly database: QueryCreator<AuditDatabase>
  constructor(
    executor: QueryExecutorProvider,
    private readonly now: () => Date = () => new Date(),
  ) {
    // Share the caller's executor (including transaction connection), not a new pool.
    this.database = new QueryCreator<AuditDatabase>({ executor: executor.getExecutor() })
  }

  async append(entry: AuditEntry): Promise<void> {
    await this.database
      .insertInto('platform.audit_log')
      .values({
        id: newEntityId(),
        tenant_id: entry.context.tenantId,
        request_id: entry.context.requestId,
        actor_user_id: entry.context.userId,
        module: entry.module,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        result: entry.result,
        before_data: entry.before ?? null,
        after_data: entry.after ?? null,
        ip_address: entry.ipAddress ?? null,
        user_agent: entry.userAgent ?? null,
        created_at: this.now(),
      })
      .executeTakeFirstOrThrow()
  }
}
