import { sql, type Kysely } from 'kysely'

/**
 * Adds the management catalog while preserving any foundation rows. PostgreSQL 18's uuidv7()
 * supplies one default category for each tenant that already has foundation type rows.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .withSchema('dictionary')
    .createTable('dictionary_category')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('dictionary_category_tenant_code_uq', ['tenant_id', 'code'])
    .addUniqueConstraint('dictionary_category_owner_uq', ['tenant_id', 'id'])
    .execute()

  await sql`ALTER TABLE dictionary.dictionary_category
    ADD CONSTRAINT dictionary_category_revision_ck CHECK (revision > 0)`.execute(database)

  await sql`ALTER TABLE dictionary.dictionary_type
    ADD COLUMN category_id uuid,
    ADD COLUMN revision integer NOT NULL DEFAULT 1,
    ADD CONSTRAINT dictionary_type_revision_ck CHECK (revision > 0),
    ADD CONSTRAINT dictionary_type_status_ck CHECK (status IN ('ENABLED','DISABLED')),
    ADD CONSTRAINT dictionary_type_owner_uq UNIQUE (tenant_id, id)`.execute(database)

  await sql`INSERT INTO dictionary.dictionary_category
      (id, tenant_id, code, name, sort_order, revision, created_at, created_by, updated_at, updated_by)
    SELECT uuidv7(), tenant_id, 'common', '通用数据', 0, 1, now(), NULL, now(), NULL
    FROM dictionary.dictionary_type
    GROUP BY tenant_id
    ON CONFLICT (tenant_id, code) DO NOTHING`.execute(database)

  await sql`UPDATE dictionary.dictionary_type AS type
    SET category_id = category.id
    FROM dictionary.dictionary_category AS category
    WHERE category.tenant_id = type.tenant_id AND category.code = 'common'`.execute(database)

  await sql`ALTER TABLE dictionary.dictionary_type
    ALTER COLUMN category_id SET NOT NULL,
    ADD CONSTRAINT dictionary_type_category_tenant_fk
      FOREIGN KEY (tenant_id, category_id)
      REFERENCES dictionary.dictionary_category(tenant_id, id)`.execute(database)

  await sql`ALTER TABLE dictionary.dictionary_item
    DROP CONSTRAINT dictionary_item_dictionary_type_id_fkey,
    DROP CONSTRAINT dictionary_item_type_code_uq,
    ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ENABLED'`.execute(database)

  await sql`UPDATE dictionary.dictionary_item
    SET status = CASE WHEN enabled THEN 'ENABLED' ELSE 'DISABLED' END`.execute(database)

  await sql`ALTER TABLE dictionary.dictionary_item
    DROP COLUMN enabled,
    DROP COLUMN value,
    ADD CONSTRAINT dictionary_item_status_ck CHECK (status IN ('ENABLED','DISABLED')),
    ADD CONSTRAINT dictionary_item_tenant_type_code_uq UNIQUE (tenant_id, dictionary_type_id, code),
    ADD CONSTRAINT dictionary_item_type_tenant_fk
      FOREIGN KEY (tenant_id, dictionary_type_id)
      REFERENCES dictionary.dictionary_type(tenant_id, id)`.execute(database)

  await sql`CREATE INDEX dictionary_type_category_sort_idx
    ON dictionary.dictionary_type (tenant_id, category_id, name, code)`.execute(database)
  await sql`CREATE INDEX dictionary_item_type_sort_idx
    ON dictionary.dictionary_item (tenant_id, dictionary_type_id, sort_order, code)`.execute(
    database,
  )
}

// This migration intentionally removes the ambiguous value column; recover through a reviewed forward migration.
export function down(): Promise<void> {
  return Promise.reject(
    new Error('Dictionary catalog migration requires a forward recovery migration'),
  )
}
