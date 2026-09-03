import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('platform').ifNotExists().execute()
  await database.schema
    .withSchema('platform')
    .createTable('auth_session')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('user_id', 'uuid', (column) => column.notNull())
    .addColumn('token_hash', 'varchar(64)', (column) => column.notNull().unique())
    .addColumn('csrf_token_hash', 'varchar(64)', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('last_seen_at', 'timestamptz', (column) => column.notNull())
    .addColumn('idle_expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('absolute_expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('user_agent', 'varchar(512)')
    .addColumn('ip_address', 'varchar(64)')
    .execute()

  await database.schema
    .withSchema('platform')
    .createIndex('auth_session_user_active_idx')
    .on('auth_session')
    .columns(['tenant_id', 'user_id', 'revoked_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('platform').dropTable('auth_session').execute()
}
