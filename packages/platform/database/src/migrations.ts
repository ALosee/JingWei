import type { Migration, MigrationProvider } from 'kysely/migration'

export type MigrationMap = Readonly<Record<string, Migration>>

/**
 * Supplies an already-selected, static migration map to Kysely.
 * Edition selection must happen before construction; request-time code must never discover or run
 * migrations dynamically.
 */
export class StaticMigrationProvider implements MigrationProvider {
  constructor(private readonly migrations: MigrationMap) {}

  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({ ...this.migrations })
  }
}
