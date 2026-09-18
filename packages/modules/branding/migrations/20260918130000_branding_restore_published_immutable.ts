import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  // Restore full immutability: published brand versions cannot be updated or deleted.
  await sql`CREATE OR REPLACE FUNCTION branding.protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Published brand version is immutable';
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error(
      'Branding published-version immutability requires a reviewed forward recovery migration',
    ),
  )
}
