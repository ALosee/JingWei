import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('platform').ifNotExists().execute()
  await database.schema
    .withSchema('platform')
    .createTable('outbox')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('event_type', 'varchar(160)', (column) => column.notNull())
    .addColumn('event_version', 'integer', (column) => column.notNull())
    .addColumn('aggregate_type', 'varchar(120)', (column) => column.notNull())
    .addColumn('aggregate_id', 'varchar(160)', (column) => column.notNull())
    .addColumn('payload', 'jsonb', (column) => column.notNull())
    .addColumn('occurred_at', 'timestamptz', (column) => column.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('attempts', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('next_attempt_at', 'timestamptz', (column) => column.notNull())
    .addColumn('last_error', 'text')
    .addColumn('locked_at', 'timestamptz')
    .addColumn('locked_by', 'varchar(120)')
    .execute()

  await database.schema
    .withSchema('platform')
    .createIndex('outbox_pending_idx')
    .on('outbox')
    .columns(['published_at', 'next_attempt_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('platform').dropTable('outbox').execute()
}
