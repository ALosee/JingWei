import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE branding.brand_version
    ADD COLUMN theme_base_palette varchar(20) NOT NULL DEFAULT 'zinc',
    ADD COLUMN theme_primary_palette varchar(20) NOT NULL DEFAULT 'indigo',
    ADD COLUMN theme_radius varchar(10) NOT NULL DEFAULT 'md',
    ADD COLUMN theme_sidebar_scheme varchar(20) NOT NULL DEFAULT 'derived',
    ADD COLUMN workspace_layout_mode varchar(10) NOT NULL DEFAULT 'left',
    ADD COLUMN workspace_brand_placement varchar(10) NOT NULL DEFAULT 'header',
    ADD COLUMN workspace_header_height integer NOT NULL DEFAULT 56,
    ADD COLUMN workspace_sider_width integer NOT NULL DEFAULT 220,
    ADD COLUMN workspace_show_tabs boolean NOT NULL DEFAULT true,
    ADD CONSTRAINT brand_version_theme_base_palette_ck CHECK (
      theme_base_palette IN ('slate','mist','gray','zinc','neutral','stone','taupe','olive','mauve')
    ),
    ADD CONSTRAINT brand_version_theme_primary_palette_ck CHECK (
      theme_primary_palette IN (
        'slate','mist','gray','zinc','neutral','stone','taupe','olive','mauve','red','orange',
        'amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet',
        'purple','fuchsia','pink','rose'
      )
    ),
    ADD CONSTRAINT brand_version_theme_radius_ck CHECK (
      theme_radius IN ('2xs','xs','sm','md','lg','xl','2xl')
    ),
    ADD CONSTRAINT brand_version_theme_sidebar_scheme_ck CHECK (
      theme_sidebar_scheme IN ('derived','inverted-dark','soft','contrast')
    ),
    ADD CONSTRAINT brand_version_workspace_layout_mode_ck CHECK (
      workspace_layout_mode IN ('left','top')
    ),
    ADD CONSTRAINT brand_version_workspace_brand_placement_ck CHECK (
      workspace_brand_placement IN ('header','sider')
    ),
    ADD CONSTRAINT brand_version_workspace_header_height_ck CHECK (
      workspace_header_height BETWEEN 48 AND 96
    ),
    ADD CONSTRAINT brand_version_workspace_sider_width_ck CHECK (
      workspace_sider_width BETWEEN 192 AND 360
    )`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Tenant presentation defaults require a reviewed forward recovery migration'),
  )
}
