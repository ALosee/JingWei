import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

/**
 * Process-scoped PostgreSQL resource owner.
 *
 * Every typed Kysely view shares one pool; `TDatabase` changes only compile-time table visibility
 * and provides no runtime tenant isolation. Create this object in the application composition root
 * and dispose it exactly once during shutdown.
 */
export class DatabaseRuntime {
  readonly #pool: Pool

  constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString })
  }

  /** Creates a typed Kysely facade over the shared pool. */
  view<TDatabase>(): Kysely<TDatabase> {
    return new Kysely<TDatabase>({
      dialect: new PostgresDialect({ pool: this.#pool }),
    })
  }

  /** Stops accepting new pool work and waits for PostgreSQL connections to close. */
  async dispose(): Promise<void> {
    await this.#pool.end()
  }
}
