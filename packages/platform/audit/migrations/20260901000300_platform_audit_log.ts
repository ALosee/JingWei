import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('platform').ifNotExists().execute()
  await database.schema
    .withSchema('platform')
    .createTable('audit_log')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('request_id', 'uuid', (column) => column.notNull())
    .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
    .addColumn('module', 'varchar(80)', (column) => column.notNull())
    .addColumn('action', 'varchar(120)', (column) => column.notNull())
    .addColumn('entity_type', 'varchar(120)', (column) => column.notNull())
    .addColumn('entity_id', 'varchar(160)', (column) => column.notNull())
    .addColumn('result', 'varchar(20)', (column) => column.notNull())
    .addColumn('before_data', 'jsonb')
    .addColumn('after_data', 'jsonb')
    .addColumn('ip_address', 'varchar(64)')
    .addColumn('user_agent', 'varchar(512)')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .execute()

  await database.schema
    .withSchema('platform')
    .createIndex('audit_log_tenant_created_idx')
    .on('audit_log')
    .columns(['tenant_id', 'created_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('platform').dropTable('audit_log').execute()
}
