import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE branding.brand_version
    DROP CONSTRAINT brand_version_workspace_layout_mode_ck,
    ALTER COLUMN workspace_layout_mode TYPE varchar(32),
    ADD CONSTRAINT brand_version_workspace_layout_mode_ck CHECK (
      workspace_layout_mode IN (
        'left', 'top', 'dual-vertical', 'vertical-horizontal',
        'horizontal-vertical', 'horizontal-dual-vertical'
      )
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Published shell modes require a reviewed forward recovery migration'),
  )
}
