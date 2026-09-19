import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE branding.brand_asset
    DROP CONSTRAINT brand_asset_validation_profile_ck,
    ADD CONSTRAINT brand_asset_validation_profile_ck CHECK (
      (content_type = 'image/png' AND validation_profile = 'PNG_V1') OR
      (content_type = 'image/svg+xml' AND
        validation_profile IN ('BRAND_LOGO_SVG_V1','BRAND_LOGO_SVG_V2')) OR
      (content_type = 'image/x-icon' AND validation_profile IN ('ICO_V1','ICO_V2'))
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Branding SVG/ICO V2 assets require a reviewed forward recovery migration'),
  )
}
