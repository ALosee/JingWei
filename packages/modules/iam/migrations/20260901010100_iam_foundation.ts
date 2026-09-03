import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.createSchema('iam').ifNotExists().execute()

  await database.schema
    .withSchema('iam')
    .createTable('user')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('username', 'varchar(120)', (column) => column.notNull())
    .addColumn('username_normalized', 'varchar(120)', (column) => column.notNull())
    .addColumn('email', 'varchar(320)')
    .addColumn('email_normalized', 'varchar(320)')
    .addColumn('phone', 'varchar(40)')
    .addColumn('display_name', 'varchar(160)', (column) => column.notNull())
    .addColumn('avatar', 'varchar(512)')
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('last_login_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('user_tenant_username_uq', ['tenant_id', 'username_normalized'])
    .addUniqueConstraint('user_tenant_email_uq', ['tenant_id', 'email_normalized'])
    .execute()

  await database.schema
    .withSchema('iam')
    .createTable('user_credential')
    .ifNotExists()
    .addColumn('user_id', 'uuid', (column) =>
      column.primaryKey().references('iam.user.id').onDelete('cascade'),
    )
    .addColumn('password_hash', 'varchar(512)', (column) => column.notNull())
    .addColumn('password_changed_at', 'timestamptz', (column) => column.notNull())
    .addColumn('failed_attempts', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('locked_until', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .execute()

  await database.schema
    .withSchema('iam')
    .createTable('role')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('code', 'varchar(120)', (column) => column.notNull())
    .addColumn('name', 'varchar(160)', (column) => column.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'varchar(20)', (column) => column.notNull())
    .addColumn('is_system', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('is_super', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_by', 'uuid')
    .addUniqueConstraint('role_tenant_code_uq', ['tenant_id', 'code'])
    .execute()

  await database.schema
    .withSchema('iam')
    .createTable('user_role')
    .ifNotExists()
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('user_id', 'uuid', (column) =>
      column.notNull().references('iam.user.id').onDelete('cascade'),
    )
    .addColumn('role_id', 'uuid', (column) =>
      column.notNull().references('iam.role.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addPrimaryKeyConstraint('user_role_pk', ['tenant_id', 'user_id', 'role_id'])
    .execute()

  await database.schema
    .withSchema('iam')
    .createTable('permission_definition')
    .ifNotExists()
    .addColumn('code', 'varchar(160)', (column) => column.primaryKey())
    .addColumn('module_id', 'varchar(80)', (column) => column.notNull())
    .addColumn('name', 'varchar(160)', (column) => column.notNull())
    .addColumn('description', 'text')
    .addColumn('supports_data_scope', 'boolean', (column) => column.notNull())
    .addColumn('active', 'boolean', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull())
    .execute()

  await database.schema
    .withSchema('iam')
    .createTable('role_permission')
    .ifNotExists()
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('role_id', 'uuid', (column) =>
      column.notNull().references('iam.role.id').onDelete('cascade'),
    )
    .addColumn('permission_code', 'varchar(160)', (column) => column.notNull())
    .addColumn('scope_type', 'varchar(40)', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull())
    .addColumn('created_by', 'uuid')
    .addPrimaryKeyConstraint('role_permission_pk', ['role_id', 'permission_code'])
    .execute()

  await database.schema
    .withSchema('iam')
    .createTable('role_permission_org_scope')
    .ifNotExists()
    .addColumn('tenant_id', 'uuid', (column) => column.notNull())
    .addColumn('role_id', 'uuid', (column) => column.notNull())
    .addColumn('permission_code', 'varchar(160)', (column) => column.notNull())
    .addColumn('org_unit_id', 'uuid', (column) => column.notNull())
    .addPrimaryKeyConstraint('role_permission_org_scope_pk', [
      'role_id',
      'permission_code',
      'org_unit_id',
    ])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  for (const table of [
    'role_permission_org_scope',
    'role_permission',
    'permission_definition',
    'user_role',
    'role',
    'user_credential',
    'user',
  ]) {
    await database.schema.withSchema('iam').dropTable(table).execute()
  }
}
