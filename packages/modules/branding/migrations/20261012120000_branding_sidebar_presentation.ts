import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE branding.brand_version
    ADD COLUMN workspace_sidebar_variant varchar(10) NOT NULL DEFAULT 'sidebar',
    ADD CONSTRAINT brand_version_workspace_sidebar_variant_ck CHECK (
      workspace_sidebar_variant IN ('sidebar', 'floating', 'inset')
    ),
    DROP CONSTRAINT brand_version_workspace_brand_placement_ck,
    ALTER COLUMN workspace_brand_placement TYPE varchar(24),
    ALTER COLUMN workspace_brand_placement SET DEFAULT 'sider',
    ADD CONSTRAINT brand_version_workspace_brand_placement_ck CHECK (
      workspace_brand_placement IN ('header', 'sider', 'sider-bottom')
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Published sidebar presentation requires a reviewed forward recovery migration'),
  )
}
