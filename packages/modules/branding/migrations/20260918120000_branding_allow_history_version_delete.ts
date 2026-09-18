import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  // Published rows stay content-immutable; only the live pointer blocks deletion so
  // historical snapshots can be cleaned up after a newer publish or rollback.
  await sql`CREATE OR REPLACE FUNCTION branding.protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF OLD.published_at IS NOT NULL THEN
          RAISE EXCEPTION 'Published brand version is immutable';
        END IF;
        RETURN NEW;
      END IF;

      IF EXISTS (
        SELECT 1 FROM branding.brand_profile profile
        WHERE profile.tenant_id = OLD.tenant_id
          AND profile.published_version_id = OLD.id
      ) THEN
        RAISE EXCEPTION 'Current published brand version cannot be deleted';
      END IF;

      RETURN OLD;
    END $$`.execute(database)
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error('Branding version delete policy requires a reviewed forward recovery migration'),
  )
}
