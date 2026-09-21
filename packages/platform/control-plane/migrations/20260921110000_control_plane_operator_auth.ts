import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('control_plane').ifNotExists().execute()
  await database.schema
    .withSchema('control_plane')
    .createTable('operator')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('login', 'varchar(120)', (column) => column.notNull())
    .addColumn('login_normalized', 'varchar(120)', (column) => column.notNull().unique())
    .addColumn('display_name', 'varchar(160)', (column) => column.notNull())
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('last_login_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .execute()
  await sql`
    ALTER TABLE control_plane.operator
      ADD CONSTRAINT operator_status_check CHECK (status IN ('ACTIVE', 'DISABLED'))
  `.execute(database)
  await database.schema
    .withSchema('control_plane')
    .createTable('operator_credential')
    .addColumn('operator_id', 'uuid', (column) =>
      column.primaryKey().references('control_plane.operator.id').onDelete('cascade'),
    )
    .addColumn('password_hash', 'varchar(512)', (column) => column.notNull())
    .addColumn('failed_attempts', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('locked_until', 'timestamptz')
    .addColumn('password_changed_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .execute()
  await sql`
    ALTER TABLE control_plane.operator_credential
      ADD CONSTRAINT operator_credential_failed_attempts_check CHECK (failed_attempts >= 0)
  `.execute(database)
  await database.schema
    .withSchema('control_plane')
    .createTable('operator_session')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('operator_id', 'uuid', (column) =>
      column.notNull().references('control_plane.operator.id').onDelete('cascade'),
    )
    .addColumn('access_token_hash', 'varchar(64)', (column) => column.notNull().unique())
    .addColumn('access_expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('csrf_token_hash', 'varchar(64)', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('last_seen_at', 'timestamptz', (column) => column.notNull())
    .addColumn('idle_expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('absolute_expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('revocation_reason', 'varchar(64)')
    .addColumn('user_agent', 'varchar(512)')
    .addColumn('ip_address', 'varchar(64)')
    .execute()
  await sql`
    ALTER TABLE control_plane.operator_session
      ADD CONSTRAINT operator_session_time_check CHECK (
        created_at <= last_seen_at
        AND access_expires_at <= absolute_expires_at
        AND idle_expires_at <= absolute_expires_at
      ),
      ADD CONSTRAINT operator_session_access_hash_check CHECK (length(access_token_hash) = 64),
      ADD CONSTRAINT operator_session_csrf_hash_check CHECK (length(csrf_token_hash) = 64)
  `.execute(database)
  await database.schema
    .withSchema('control_plane')
    .createIndex('operator_session_operator_active_idx')
    .on('operator_session')
    .columns(['operator_id', 'revoked_at'])
    .execute()
  await database.schema
    .withSchema('control_plane')
    .createTable('operator_refresh_token')
    .addColumn('token_hash', 'varchar(64)', (column) => column.primaryKey())
    .addColumn('session_id', 'uuid', (column) =>
      column.notNull().references('control_plane.operator_session.id').onDelete('cascade'),
    )
    .addColumn('generation', 'integer', (column) => column.notNull())
    .addColumn('issued_at', 'timestamptz', (column) => column.notNull())
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('consumed_at', 'timestamptz')
    .execute()
  await sql`
    ALTER TABLE control_plane.operator_refresh_token
      ADD CONSTRAINT operator_refresh_generation_check CHECK (generation >= 0),
      ADD CONSTRAINT operator_refresh_time_check CHECK (issued_at <= expires_at),
      ADD CONSTRAINT operator_refresh_hash_check CHECK (length(token_hash) = 64)
  `.execute(database)
  await database.schema
    .withSchema('control_plane')
    .createIndex('operator_refresh_session_generation_idx')
    .on('operator_refresh_token')
    .columns(['session_id', 'generation'])
    .unique()
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('control_plane').dropTable('operator_refresh_token').execute()
  await database.schema.withSchema('control_plane').dropTable('operator_session').execute()
  await database.schema.withSchema('control_plane').dropTable('operator_credential').execute()
  await database.schema.withSchema('control_plane').dropTable('operator').execute()
  await database.schema.dropSchema('control_plane').execute()
}
