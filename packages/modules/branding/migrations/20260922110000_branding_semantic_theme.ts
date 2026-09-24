import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE branding.brand_version
    ADD COLUMN theme_custom_base_palette jsonb,
    ADD COLUMN theme_custom_primary_palette jsonb,
    ADD COLUMN theme_feedback_scheme varchar(20) NOT NULL DEFAULT 'classic',
    ADD COLUMN theme_chart_scheme varchar(20) NOT NULL DEFAULT 'vivid',
    ADD COLUMN theme_light_level integer NOT NULL DEFAULT 0,
    ADD COLUMN theme_dark_level integer NOT NULL DEFAULT 0,
    ADD COLUMN theme_border_opacity double precision NOT NULL DEFAULT 1,
    ADD COLUMN theme_overrides jsonb NOT NULL DEFAULT '{"light":{},"dark":{}}'::jsonb,
    ADD CONSTRAINT brand_version_theme_feedback_scheme_ck CHECK (
      theme_feedback_scheme IN ('classic','vivid','subtle','modern','professional')
    ),
    ADD CONSTRAINT brand_version_theme_chart_scheme_ck CHECK (
      theme_chart_scheme IN ('vivid','cool','warm','natural','minimal')
    ),
    ADD CONSTRAINT brand_version_theme_light_level_ck CHECK (theme_light_level BETWEEN 0 AND 2),
    ADD CONSTRAINT brand_version_theme_dark_level_ck CHECK (theme_dark_level BETWEEN 0 AND 3),
    ADD CONSTRAINT brand_version_theme_border_opacity_ck CHECK (
      theme_border_opacity BETWEEN 0 AND 1
    ),
    ADD CONSTRAINT brand_version_theme_overrides_object_ck CHECK (
      jsonb_typeof(theme_overrides) = 'object'
    ),
    ADD CONSTRAINT brand_version_theme_custom_base_palette_object_ck CHECK (
      theme_custom_base_palette IS NULL OR jsonb_typeof(theme_custom_base_palette) = 'object'
    ),
    ADD CONSTRAINT brand_version_theme_custom_primary_palette_object_ck CHECK (
      theme_custom_primary_palette IS NULL OR jsonb_typeof(theme_custom_primary_palette) = 'object'
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Semantic tenant themes require a reviewed forward recovery migration'),
  )
}
