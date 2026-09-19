import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  // PNG remains available for all purposes; MARK adds strict SVG, FAVICON adds ICO.
  await sql`ALTER TABLE branding.brand_asset
    DROP CONSTRAINT brand_asset_content_type_ck,
    ADD CONSTRAINT brand_asset_content_type_ck CHECK (
      (purpose = 'LOGO' AND content_type IN ('image/png','image/svg+xml')) OR
      (purpose = 'MARK' AND content_type IN ('image/png','image/svg+xml')) OR
      (purpose = 'FAVICON' AND content_type IN ('image/png','image/x-icon'))
    ),
    DROP CONSTRAINT brand_asset_validation_profile_ck,
    ADD CONSTRAINT brand_asset_validation_profile_ck CHECK (
      (content_type = 'image/png' AND validation_profile = 'PNG_V1') OR
      (content_type = 'image/svg+xml' AND validation_profile = 'BRAND_LOGO_SVG_V1') OR
      (content_type = 'image/x-icon' AND validation_profile = 'ICO_V1')
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Branding MARK SVG and FAVICON ICO require a reviewed forward recovery migration'),
  )
}
