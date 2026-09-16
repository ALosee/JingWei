import { sql, type Kysely } from 'kysely'

/** Replaces the lossy boolean projection with the manifest's allowed scope types and provider. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE iam.permission_definition
      ADD COLUMN allowed_scope_types varchar(40)[] NOT NULL DEFAULT ARRAY['ALL']::varchar(40)[],
      ADD COLUMN data_scope_provider varchar(80)
  `.execute(database)
  await sql`
    UPDATE iam.permission_definition
    SET
      allowed_scope_types = ARRAY[
        'ALL',
        'ORGANIZATION',
        'ORGANIZATION_AND_DESCENDANTS',
        'CUSTOM'
      ]::varchar(40)[],
      data_scope_provider = 'organization'
    WHERE code = 'organization.view' AND supports_data_scope
  `.execute(database)
  await sql`
    ALTER TABLE iam.permission_definition
      ADD CONSTRAINT permission_definition_scope_types_nonempty
        CHECK (cardinality(allowed_scope_types) > 0),
      ADD CONSTRAINT permission_definition_scope_types_known
        CHECK (
          allowed_scope_types <@ ARRAY[
            'ALL',
            'ORGANIZATION',
            'ORGANIZATION_AND_DESCENDANTS',
            'SELF',
            'CUSTOM'
          ]::varchar(40)[]
        ),
      DROP COLUMN supports_data_scope
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE iam.permission_definition
      ADD COLUMN supports_data_scope boolean NOT NULL DEFAULT false
  `.execute(database)
  await sql`
    UPDATE iam.permission_definition
    SET supports_data_scope = allowed_scope_types <> ARRAY['ALL']::varchar(40)[]
  `.execute(database)
  await sql`
    ALTER TABLE iam.permission_definition
      DROP CONSTRAINT permission_definition_scope_types_known,
      DROP CONSTRAINT permission_definition_scope_types_nonempty,
      DROP COLUMN data_scope_provider,
      DROP COLUMN allowed_scope_types
  `.execute(database)
}
