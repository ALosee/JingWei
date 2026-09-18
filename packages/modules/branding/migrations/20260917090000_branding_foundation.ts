import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('branding').ifNotExists().execute()

  await database.schema
    .withSchema('branding')
    .createTable('brand_profile')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull().unique())
    .addColumn('published_version_id', 'uuid')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid', (column) => column.notNull())
    .addUniqueConstraint('brand_profile_owner_uq', ['tenant_id', 'id'])
    .execute()

  await database.schema
    .withSchema('branding')
    .createTable('brand_asset')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('purpose', 'varchar(20)', (column) => column.notNull())
    .addColumn('content_type', 'varchar(40)', (column) => column.notNull())
    .addColumn('sha256', 'varchar(64)', (column) => column.notNull())
    .addColumn('width', 'integer', (column) => column.notNull())
    .addColumn('height', 'integer', (column) => column.notNull())
    .addColumn('byte_size', 'integer', (column) => column.notNull())
    .addColumn('payload', 'bytea', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addUniqueConstraint('brand_asset_owner_uq', ['tenant_id', 'id'])
    .addUniqueConstraint('brand_asset_content_uq', ['tenant_id', 'purpose', 'sha256'])
    .execute()

  await sql`ALTER TABLE branding.brand_asset
    ADD CONSTRAINT brand_asset_purpose_ck CHECK (purpose IN ('LOGO','MARK','FAVICON')),
    ADD CONSTRAINT brand_asset_content_type_ck CHECK (content_type = 'image/png'),
    ADD CONSTRAINT brand_asset_dimensions_ck CHECK (width > 0 AND height > 0),
    ADD CONSTRAINT brand_asset_size_ck CHECK (byte_size > 0 AND byte_size <= 524288)`.execute(
    database,
  )

  await database.schema
    .withSchema('branding')
    .createTable('brand_version')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('profile_id', 'uuid', (column) => column.notNull())
    .addColumn('version', 'integer', (column) => column.notNull())
    .addColumn('edit_revision', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('system_name', 'varchar(80)', (column) => column.notNull())
    .addColumn('short_name', 'varchar(24)', (column) => column.notNull())
    .addColumn('login_title', 'varchar(100)', (column) => column.notNull())
    .addColumn('login_tagline', 'varchar(240)', (column) => column.notNull())
    .addColumn('title_mode', 'varchar(30)', (column) => column.notNull())
    .addColumn('logo_asset_id', 'uuid')
    .addColumn('mark_asset_id', 'uuid')
    .addColumn('favicon_asset_id', 'uuid')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('published_by', 'uuid')
    .addUniqueConstraint('brand_version_owner_uq', ['tenant_id', 'id'])
    .addUniqueConstraint('brand_version_profile_uq', ['tenant_id', 'profile_id', 'id'])
    .addUniqueConstraint('brand_version_revision_uq', ['tenant_id', 'profile_id', 'version'])
    .execute()

  await sql`ALTER TABLE branding.brand_version
    ADD CONSTRAINT brand_version_status_ck CHECK (status IN ('DRAFT','PUBLISHED')),
    ADD CONSTRAINT brand_version_title_mode_ck CHECK (title_mode IN ('SYSTEM_ONLY','PAGE_AND_SYSTEM')),
    ADD CONSTRAINT brand_version_revision_ck CHECK (version > 0 AND edit_revision >= 0),
    ADD CONSTRAINT brand_version_profile_fk FOREIGN KEY (tenant_id, profile_id)
      REFERENCES branding.brand_profile(tenant_id, id),
    ADD CONSTRAINT brand_version_logo_fk FOREIGN KEY (tenant_id, logo_asset_id)
      REFERENCES branding.brand_asset(tenant_id, id),
    ADD CONSTRAINT brand_version_mark_fk FOREIGN KEY (tenant_id, mark_asset_id)
      REFERENCES branding.brand_asset(tenant_id, id),
    ADD CONSTRAINT brand_version_favicon_fk FOREIGN KEY (tenant_id, favicon_asset_id)
      REFERENCES branding.brand_asset(tenant_id, id)`.execute(database)

  await sql`ALTER TABLE branding.brand_profile ADD CONSTRAINT brand_profile_published_fk
    FOREIGN KEY (tenant_id, id, published_version_id)
    REFERENCES branding.brand_version(tenant_id, profile_id, id) DEFERRABLE INITIALLY DEFERRED`.execute(
    database,
  )

  await sql`CREATE FUNCTION branding.protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published brand version is immutable'; END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$`.execute(database)
  await sql`CREATE TRIGGER brand_version_immutable BEFORE UPDATE OR DELETE ON branding.brand_version
    FOR EACH ROW EXECUTE FUNCTION branding.protect_published_version()`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Branding foundation requires a reviewed forward recovery migration'),
  )
}
