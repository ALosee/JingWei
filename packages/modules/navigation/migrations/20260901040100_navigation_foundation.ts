import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('navigation').ifNotExists().execute()
  await database.schema
    .withSchema('navigation')
    .createTable('navigation')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('kind', 'varchar(30)', (column) => column.notNull())
    .addColumn('published_version_id', 'uuid')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('navigation_tenant_code_uq', ['tenant_id', 'code'])
    .execute()

  await database.schema
    .withSchema('navigation')
    .createTable('navigation_version')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('navigation_id', 'uuid', (column) =>
      column.notNull().references('navigation.navigation.id').onDelete('cascade'),
    )
    .addColumn('version', 'integer', (column) => column.notNull())
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addUniqueConstraint('navigation_version_uq', ['navigation_id', 'version'])
    .execute()

  await database.schema
    .withSchema('navigation')
    .createTable('navigation_node')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('version_id', 'uuid', (column) =>
      column.notNull().references('navigation.navigation_version.id').onDelete('cascade'),
    )
    .addColumn('parent_id', 'uuid')
    .addColumn('type', 'varchar(30)', (column) => column.notNull())
    .addColumn('route_key', 'varchar(160)')
    .addColumn('path', 'varchar(500)')
    .addColumn('title', 'varchar(200)', (column) => column.notNull())
    .addColumn('icon', 'varchar(160)')
    .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('visible', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('access_mode', 'varchar(30)')
    .addColumn('external_url', 'varchar(2048)')
    .addColumn('external_target', 'varchar(20)')
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('navigation').dropTable('navigation_node').execute()
  await database.schema.withSchema('navigation').dropTable('navigation_version').execute()
  await database.schema.withSchema('navigation').dropTable('navigation').execute()
}
