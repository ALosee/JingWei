import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('organization').ifNotExists().execute()

  await database.schema
    .withSchema('organization')
    .createTable('org_unit')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('parent_id', 'uuid', (column) => column.references('organization.org_unit.id'))
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('type', 'varchar(30)', (column) => column.notNull())
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('org_unit_tenant_code_uq', ['tenant_id', 'code'])
    .execute()

  await database.schema
    .withSchema('organization')
    .createTable('position')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('org_unit_id', 'uuid', (column) =>
      column.notNull().references('organization.org_unit.id'),
    )
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('name', 'varchar(200)', (column) => column.notNull())
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('sort_order', 'integer', (column) => column.notNull().defaultTo(0))
    .addUniqueConstraint('position_tenant_org_code_uq', ['tenant_id', 'org_unit_id', 'code'])
    .execute()

  await database.schema
    .withSchema('organization')
    .createTable('user_org')
    .ifNotExists()
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('user_id', 'uuid', (column) => column.notNull())
    .addColumn('org_unit_id', 'uuid', (column) =>
      column.notNull().references('organization.org_unit.id').onDelete('cascade'),
    )
    .addColumn('is_primary', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('joined_at', 'date')
    .addPrimaryKeyConstraint('user_org_pk', ['tenant_id', 'user_id', 'org_unit_id'])
    .execute()

  await database.schema
    .withSchema('organization')
    .createTable('user_position')
    .ifNotExists()
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('user_id', 'uuid', (column) => column.notNull())
    .addColumn('position_id', 'uuid', (column) =>
      column.notNull().references('organization.position.id').onDelete('cascade'),
    )
    .addColumn('is_primary', 'boolean', (column) => column.notNull().defaultTo(false))
    .addPrimaryKeyConstraint('user_position_pk', ['tenant_id', 'user_id', 'position_id'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  for (const table of ['user_position', 'user_org', 'position', 'org_unit']) {
    await database.schema.withSchema('organization').dropTable(table).execute()
  }
}
