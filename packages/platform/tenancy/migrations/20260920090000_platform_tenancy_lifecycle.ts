import { sql, type Kysely } from 'kysely'

/** Adds explicit, resumable tenant lifecycle state without rewriting the platform foundation migration. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('platform')
    .alterTable('tenant')
    .addColumn('version', 'bigint', (column) => column.notNull().defaultTo(1))
    .addColumn('provisioning_step', 'varchar(40)', (column) =>
      column.notNull().defaultTo('COMPLETED'),
    )
    .addColumn('provisioning_error_code', 'varchar(120)')
    .execute()

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT lower(code)
        FROM platform.tenant
        GROUP BY lower(code)
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Tenant codes collide after lowercase normalization';
      END IF;
    END
    $$
  `.execute(database)
  await sql`UPDATE platform.tenant SET code = lower(code) WHERE code <> lower(code)`.execute(
    database,
  )

  await sql`
    ALTER TABLE platform.tenant
      ADD CONSTRAINT tenant_status_check
        CHECK (status IN ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
      ADD CONSTRAINT tenant_provisioning_step_check
        CHECK (provisioning_step IN ('TENANT_RESERVED', 'IAM_INITIALIZED', 'NAVIGATION_INITIALIZED', 'COMPLETED')),
      ADD CONSTRAINT tenant_code_normalized_check
        CHECK (code = lower(code))
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE platform.tenant
      DROP CONSTRAINT tenant_code_normalized_check,
      DROP CONSTRAINT tenant_provisioning_step_check,
      DROP CONSTRAINT tenant_status_check
  `.execute(database)
  await database.schema
    .withSchema('platform')
    .alterTable('tenant')
    .dropColumn('provisioning_error_code')
    .dropColumn('provisioning_step')
    .dropColumn('version')
    .execute()
}
