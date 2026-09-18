import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_org_tenant_user_primary_uq
    ON organization.user_org (tenant_id, user_id)
    WHERE is_primary
  `.execute(database)

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_position_tenant_user_primary_uq
    ON organization.user_position (tenant_id, user_id)
    WHERE is_primary
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS organization.user_position_tenant_user_primary_uq`.execute(
    database,
  )
  await sql`DROP INDEX IF EXISTS organization.user_org_tenant_user_primary_uq`.execute(database)
}
