import { sql, type Kysely } from 'kysely'

/** Forward migration: preserves legacy rows, then protects tenant/version ownership and snapshots. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE navigation.navigation_node RENAME COLUMN title TO name`.execute(database)
  await sql`ALTER TABLE navigation.navigation_node RENAME COLUMN external_url TO href`.execute(
    database,
  )
  await sql`ALTER TABLE navigation.navigation_node
    ADD COLUMN code varchar(120), ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ENABLED',
    ADD COLUMN layout varchar(20), ADD COLUMN params jsonb NOT NULL DEFAULT '{}',
    ADD COLUMN query jsonb NOT NULL DEFAULT '{}'`.execute(database)
  await sql`UPDATE navigation.navigation_node SET
    code = COALESCE(route_key, 'node.' || id::text),
    layout = CASE WHEN type = 'ROUTE' THEN CASE WHEN route_key = 'iam.login' THEN 'blank' ELSE 'base' END ELSE NULL END,
    type = CASE WHEN type = 'ROUTE' THEN CASE WHEN visible THEN 'MENU' ELSE 'PAGE' END ELSE type END`.execute(
    database,
  )
  await sql`ALTER TABLE navigation.navigation_node
    ALTER COLUMN code SET NOT NULL, DROP COLUMN visible,
    ADD CONSTRAINT navigation_node_type_ck CHECK (type IN ('DIRECTORY','GROUP','MENU','PAGE','EXTERNAL_LINK')),
    ADD CONSTRAINT navigation_node_status_ck CHECK (status IN ('ENABLED','DISABLED')),
    ADD CONSTRAINT navigation_node_layout_ck CHECK (layout IS NULL OR layout IN ('base','blank')),
    ADD CONSTRAINT navigation_node_access_ck CHECK (access_mode IS NULL OR access_mode IN ('PUBLIC','AUTHENTICATED','PERMISSION')),
    ADD CONSTRAINT navigation_node_json_ck CHECK (jsonb_typeof(params) = 'object' AND jsonb_typeof(query) = 'object'),
    ADD CONSTRAINT navigation_node_code_uq UNIQUE (tenant_id, version_id, code),
    ADD CONSTRAINT navigation_node_route_uq UNIQUE (tenant_id, version_id, route_key),
    ADD CONSTRAINT navigation_node_owner_uq UNIQUE (tenant_id, version_id, id)`.execute(database)
  await sql`ALTER TABLE navigation.navigation_version
    ADD COLUMN auth_entry_code varchar(120) NOT NULL DEFAULT 'iam.login',
    ADD COLUMN home_code varchar(120), ADD COLUMN edit_revision integer NOT NULL DEFAULT 0,
    ADD COLUMN published_by uuid,
    ADD CONSTRAINT navigation_version_owner_uq UNIQUE (tenant_id, id),
    ADD CONSTRAINT navigation_version_root_uq UNIQUE (tenant_id, navigation_id, id)`.execute(
    database,
  )
  await sql`ALTER TABLE navigation.navigation ADD CONSTRAINT navigation_owner_uq UNIQUE (tenant_id, id)`.execute(
    database,
  )
  await sql`ALTER TABLE navigation.navigation_version ADD CONSTRAINT navigation_version_tenant_fk
    FOREIGN KEY (tenant_id, navigation_id) REFERENCES navigation.navigation(tenant_id, id)`.execute(
    database,
  )
  await sql`ALTER TABLE navigation.navigation_node ADD CONSTRAINT navigation_node_version_tenant_fk
    FOREIGN KEY (tenant_id, version_id) REFERENCES navigation.navigation_version(tenant_id, id) ON DELETE CASCADE`.execute(
    database,
  )
  await sql`ALTER TABLE navigation.navigation_node ADD CONSTRAINT navigation_node_parent_fk
    FOREIGN KEY (tenant_id, version_id, parent_id) REFERENCES navigation.navigation_node(tenant_id, version_id, id)
    DEFERRABLE INITIALLY DEFERRED`.execute(database)
  await sql`ALTER TABLE navigation.navigation ADD CONSTRAINT navigation_published_fk
    FOREIGN KEY (tenant_id, id, published_version_id)
    REFERENCES navigation.navigation_version(tenant_id, navigation_id, id) DEFERRABLE INITIALLY DEFERRED`.execute(
    database,
  )

  await database.schema
    .withSchema('navigation')
    .createTable('role_navigation')
    .addColumn('tenant_id', 'uuid', (c) => c.notNull())
    .addColumn('role_id', 'uuid', (c) => c.notNull())
    .addColumn('navigation_code', 'varchar(120)', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('created_by', 'uuid', (c) => c.notNull())
    .addPrimaryKeyConstraint('role_navigation_pk', ['tenant_id', 'role_id', 'navigation_code'])
    .execute()

  await sql`CREATE FUNCTION navigation.protect_published_nodes() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM navigation.navigation_version
        WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END AND published_at IS NOT NULL)
        OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM navigation.navigation_version WHERE id = OLD.version_id AND published_at IS NOT NULL))
      THEN RAISE EXCEPTION 'Published navigation nodes are immutable'; END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$`.execute(database)
  await sql`CREATE TRIGGER navigation_nodes_immutable BEFORE INSERT OR UPDATE OR DELETE ON navigation.navigation_node
    FOR EACH ROW EXECUTE FUNCTION navigation.protect_published_nodes()`.execute(database)
  await sql`CREATE FUNCTION navigation.protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published navigation version is immutable'; END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$`.execute(database)
  await sql`CREATE TRIGGER navigation_version_immutable BEFORE UPDATE OR DELETE ON navigation.navigation_version
    FOR EACH ROW EXECUTE FUNCTION navigation.protect_published_version()`.execute(database)
}

// Irreversible semantic conversion: recover with a reviewed forward migration.
export function down(): Promise<void> {
  return Promise.reject(
    new Error('Navigation configuration migration requires a forward recovery migration'),
  )
}
