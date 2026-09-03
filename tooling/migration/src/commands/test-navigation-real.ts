import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { loadConfig } from '@jingwei/config'
import { DatabaseRuntime } from '@jingwei/database'

/** Explicit command boundary; importing this module performs no I/O. */
export async function runNavigationIntegrationTests(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(environment)
  if (config.environment === 'production') throw new Error('Real navigation tests are forbidden in production')
  const name = 'jingwei_navigation_test_' + randomUUID().replaceAll('-', '')
  const maintenance = new DatabaseRuntime(config.databaseUrl)
  let created = false
  try {
    await sql`CREATE DATABASE ${sql.id(name)}`.execute(maintenance.view())
    created = true
    const url = new URL(config.databaseUrl)
    url.pathname = '/' + name
    console.log('Testing migrations and navigation against isolated PostgreSQL database ' + name)
    const result = spawnSync('pnpm', ['exec', 'vitest', 'run', 'tooling/migration/src/navigation.integration.test.ts'],
      { stdio: 'inherit', env: { ...environment, TEST_DATABASE_URL: url.toString() } })
    process.exitCode = result.status ?? 1
  } finally {
    if (created) {
      await sql`DROP DATABASE ${sql.id(name)} WITH (FORCE)`.execute(maintenance.view())
      console.log('Removed temporary test database ' + name + '; application database was not changed')
    }
    await maintenance.dispose()
  }
}
