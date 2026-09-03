import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('dictionary').ifNotExists().execute()
  await database.schema
    .withSchema('dictionary')
    .createTable('dictionary_type')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('dictionary_type_tenant_code_uq', ['tenant_id', 'code'])
    .execute()

  await database.schema
    .withSchema('dictionary')
    .createTable('dictionary_item')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('dictionary_type_id', 'uuid', (column) =>
      column.notNull().references('dictionary.dictionary_type.id').onDelete('cascade'),
    )
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('label', 'varchar(200)', (column) => column.notNull())
    .addColumn('value', 'varchar(500)', (column) => column.notNull())
    .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('dictionary_item_type_code_uq', ['dictionary_type_id', 'code'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('dictionary').dropTable('dictionary_item').execute()
  await database.schema.withSchema('dictionary').dropTable('dictionary_type').execute()
}
