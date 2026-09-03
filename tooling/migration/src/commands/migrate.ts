import { Migrator } from 'kysely/migration'

import { loadConfig } from '@jingwei/config'
import { DatabaseRuntime, StaticMigrationProvider } from '@jingwei/database'

import { generatedMigrations } from '../../../../apps/server/src/generated/migrations.js'

/** Explicit command boundary; importing this module performs no I/O. */
export async function runMigrationCommand(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const command = process.argv[2] ?? 'status'
  const config = loadConfig(environment)
  const runtime = new DatabaseRuntime(config.databaseUrl)
  const database = runtime.view<unknown>()
  const migrator = new Migrator({
    db: database,
    provider: new StaticMigrationProvider(generatedMigrations),
  })

  try {
    if (command === 'up') {
      const result = await migrator.migrateToLatest()
      for (const migration of result.results ?? []) {
        console.log(`${migration.status}: ${migration.migrationName}`)
      }
      if (result.error instanceof Error) throw result.error
      if (result.error !== undefined) {
        throw new Error('Migration failed with a non-error cause', { cause: result.error })
      }
    } else if (command === 'status') {
      const migrations = await migrator.getMigrations()
      for (const migration of migrations) {
        console.log(`${migration.executedAt === undefined ? 'PENDING' : 'EXECUTED'} ${migration.name}`)
      }
    } else {
      throw new Error(`Unknown migration command: ${command}`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await runtime.dispose()
  }
}
