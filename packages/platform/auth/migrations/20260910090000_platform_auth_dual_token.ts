import { sql, type Kysely } from 'kysely'

/**
 * Evolves the original opaque session into a short-lived access token plus a rotating refresh
 * token family. Existing sessions are intentionally revoked because their raw value cannot be
 * converted into a refresh credential.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('platform')
    .alterTable('auth_session')
    .renameColumn('token_hash', 'access_token_hash')
    .execute()
  await database.schema
    .withSchema('platform')
    .alterTable('auth_session')
    .addColumn('access_expires_at', 'timestamptz')
    .addColumn('revocation_reason', 'varchar(64)')
    .execute()

  await sql`
    update platform.auth_session
    set
      access_expires_at = current_timestamp,
      revoked_at = coalesce(revoked_at, current_timestamp),
      revocation_reason = coalesce(revocation_reason, 'TOKEN_ARCHITECTURE_MIGRATION')
  `.execute(database)

  await database.schema
    .withSchema('platform')
    .alterTable('auth_session')
    .alterColumn('access_expires_at', (column) => column.setNotNull())
    .execute()

  await database.schema
    .withSchema('platform')
    .createTable('auth_refresh_token')
    .addColumn('token_hash', 'varchar(64)', (column) => column.primaryKey())
    .addColumn('session_id', 'uuid', (column) =>
      column.notNull().references('platform.auth_session.id').onDelete('cascade'),
    )
    .addColumn('generation', 'integer', (column) => column.notNull())
    .addColumn('issued_at', 'timestamptz', (column) => column.notNull())
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('consumed_at', 'timestamptz')
    .execute()

  await database.schema
    .withSchema('platform')
    .createIndex('auth_refresh_token_session_generation_idx')
    .on('auth_refresh_token')
    .columns(['session_id', 'generation'])
    .unique()
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('platform').dropTable('auth_refresh_token').execute()
  await database.schema
    .withSchema('platform')
    .alterTable('auth_session')
    .dropColumn('revocation_reason')
    .dropColumn('access_expires_at')
    .renameColumn('access_token_hash', 'token_hash')
    .execute()
}
