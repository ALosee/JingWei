import { sql, type Kysely } from 'kysely'

/** Distinguishes tenant-user audit actors from control-plane operators and automation. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('platform')
    .alterTable('audit_log')
    .addColumn('scope', 'varchar(20)', (column) => column.notNull().defaultTo('TENANT'))
    .addColumn('actor_type', 'varchar(32)', (column) => column.notNull().defaultTo('TENANT_USER'))
    .addColumn('actor_id', 'varchar(160)')
    .execute()

  await sql`
    UPDATE platform.audit_log
    SET actor_id = actor_user_id::text
    WHERE actor_id IS NULL
  `.execute(database)

  await database.schema
    .withSchema('platform')
    .alterTable('audit_log')
    .alterColumn('actor_id', (column) => column.setNotNull())
    .alterColumn('actor_user_id', (column) => column.dropNotNull())
    .execute()

  await sql`
    ALTER TABLE platform.audit_log
      ADD CONSTRAINT audit_log_scope_check
        CHECK (scope IN ('TENANT', 'PLATFORM')),
      ADD CONSTRAINT audit_log_actor_type_check
        CHECK (actor_type IN ('TENANT_USER', 'PLATFORM_OPERATOR', 'CLI', 'SYSTEM')),
      ADD CONSTRAINT audit_log_actor_shape_check
        CHECK (
          (actor_type = 'TENANT_USER' AND actor_user_id IS NOT NULL AND actor_id = actor_user_id::text)
          OR (actor_type <> 'TENANT_USER' AND actor_user_id IS NULL)
        )
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE platform.audit_log
      DROP CONSTRAINT audit_log_actor_shape_check,
      DROP CONSTRAINT audit_log_actor_type_check,
      DROP CONSTRAINT audit_log_scope_check
  `.execute(database)
  await database.schema
    .withSchema('platform')
    .alterTable('audit_log')
    .alterColumn('actor_user_id', (column) => column.setNotNull())
    .dropColumn('actor_id')
    .dropColumn('actor_type')
    .dropColumn('scope')
    .execute()
}
