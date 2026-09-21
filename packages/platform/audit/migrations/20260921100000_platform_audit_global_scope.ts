import { sql, type Kysely } from 'kysely'

/** Allows platform-wide actions to be audited without inventing a target tenant. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE platform.audit_log
      DROP CONSTRAINT audit_log_actor_shape_check
  `.execute(database)
  await database.schema
    .withSchema('platform')
    .alterTable('audit_log')
    .alterColumn('tenant_id', (column) => column.dropNotNull())
    .execute()
  await sql`
    ALTER TABLE platform.audit_log
      ADD CONSTRAINT audit_log_actor_shape_check
        CHECK (
          (
            scope = 'TENANT'
            AND tenant_id IS NOT NULL
            AND actor_type = 'TENANT_USER'
            AND actor_user_id IS NOT NULL
            AND actor_id = actor_user_id::text
          )
          OR (
            scope = 'PLATFORM'
            AND actor_type <> 'TENANT_USER'
            AND actor_user_id IS NULL
          )
        )
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  const globalRows = await sql<{ count: string }>`
    SELECT count(*)::text AS count
    FROM platform.audit_log
    WHERE tenant_id IS NULL
  `.execute(database)
  if (globalRows.rows[0]?.count !== '0') {
    throw new Error('Cannot restore tenant-only audit schema while global audit rows exist')
  }
  await sql`
    ALTER TABLE platform.audit_log
      DROP CONSTRAINT audit_log_actor_shape_check
  `.execute(database)
  await database.schema
    .withSchema('platform')
    .alterTable('audit_log')
    .alterColumn('tenant_id', (column) => column.setNotNull())
    .execute()
  await sql`
    ALTER TABLE platform.audit_log
      ADD CONSTRAINT audit_log_actor_shape_check
        CHECK (
          (actor_type = 'TENANT_USER' AND actor_user_id IS NOT NULL AND actor_id = actor_user_id::text)
          OR (actor_type <> 'TENANT_USER' AND actor_user_id IS NULL)
        )
  `.execute(database)
}
