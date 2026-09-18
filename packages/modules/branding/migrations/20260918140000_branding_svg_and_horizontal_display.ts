import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('branding')
    .alterTable('brand_asset')
    .addColumn('validation_profile', 'varchar(40)', (column) =>
      column.notNull().defaultTo('PNG_V1'),
    )
    .execute()

  await database.schema
    .withSchema('branding')
    .alterTable('brand_version')
    .addColumn('horizontal_brand_mode', 'varchar(30)')
    .addColumn('logo_color_mode', 'varchar(20)', (column) => column.notNull().defaultTo('ORIGINAL'))
    .execute()

  // Existing published snapshots are immutable to application writes, but this migration must add
  // a deterministic value to every historical row. The table lock and trigger state are scoped to
  // the migration transaction; a failure rolls both the backfill and trigger change back together.
  await sql`ALTER TABLE branding.brand_version
    DISABLE TRIGGER brand_version_immutable`.execute(database)
  await sql`UPDATE branding.brand_version
    SET horizontal_brand_mode = CASE
      WHEN logo_asset_id IS NOT NULL THEN 'CUSTOM_LOGO'
      ELSE 'SHORT_NAME'
    END`.execute(database)
  await sql`ALTER TABLE branding.brand_version
    ENABLE TRIGGER brand_version_immutable`.execute(database)

  await sql`ALTER TABLE branding.brand_version
    ALTER COLUMN horizontal_brand_mode SET NOT NULL,
    ADD CONSTRAINT brand_version_horizontal_brand_mode_ck
      CHECK (horizontal_brand_mode IN ('PLATFORM_WORDMARK','SHORT_NAME','CUSTOM_LOGO')),
    ADD CONSTRAINT brand_version_logo_color_mode_ck
      CHECK (logo_color_mode IN ('ORIGINAL','FOLLOW_THEME')),
    ADD CONSTRAINT brand_version_custom_logo_ck
      CHECK (horizontal_brand_mode <> 'CUSTOM_LOGO' OR logo_asset_id IS NOT NULL)`.execute(database)

  await sql`ALTER TABLE branding.brand_asset
    DROP CONSTRAINT brand_asset_content_type_ck,
    ADD CONSTRAINT brand_asset_content_type_ck CHECK (
      (purpose = 'LOGO' AND content_type IN ('image/png','image/svg+xml')) OR
      (purpose IN ('MARK','FAVICON') AND content_type = 'image/png')
    ),
    ADD CONSTRAINT brand_asset_validation_profile_ck CHECK (
      (content_type = 'image/png' AND validation_profile = 'PNG_V1') OR
      (content_type = 'image/svg+xml' AND validation_profile = 'BRAND_LOGO_SVG_V1')
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Branding SVG and horizontal display require a reviewed forward recovery migration'),
  )
}
