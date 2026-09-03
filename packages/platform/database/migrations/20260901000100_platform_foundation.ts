import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('platform').ifNotExists().execute()

  await database.schema
    .withSchema('platform')
    .createTable('tenant')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('code', 'varchar(80)', (column) => column.notNull().unique())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('default_locale', 'varchar(20)', (column) => column.notNull())
    .addColumn('default_timezone', 'varchar(80)', (column) => column.notNull())
    .addColumn('default_currency', 'varchar(3)', (column) => column.notNull())
    .addColumn('settings', 'jsonb', (column) =>
      column.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .execute()

  await database.schema
    .withSchema('platform')
    .createTable('number_sequence')
    .ifNotExists()
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('sequence_key', 'varchar(120)', (column) => column.notNull())
    .addColumn('business_date', 'date', (column) => column.notNull())
    .addColumn('current_value', 'bigint', (column) => column.notNull())
    .addPrimaryKeyConstraint('number_sequence_pk', [
      'tenant_id',
      'sequence_key',
      'business_date',
    ])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.withSchema('platform').dropTable('number_sequence').execute()
  await database.schema.withSchema('platform').dropTable('tenant').execute()
}
