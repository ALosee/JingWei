import { QueryCreator, type Kysely, type QueryExecutorProvider, type Transaction } from 'kysely'

/** Module-owned queries on the caller's connection, without transaction/resource ownership. */
export interface DatabaseConnection extends QueryExecutorProvider {
  view<TDatabase>(): QueryCreator<TDatabase>
}

/** Bind public module participants to the caller's transaction executor. */
export function createTransactionConnection(executor: QueryExecutorProvider): DatabaseConnection {
  return {
    getExecutor: () => executor.getExecutor(),
    view: <TDatabase>() => new QueryCreator<TDatabase>({ executor: executor.getExecutor() }),
  }
}

/** Application-level transaction boundary, kept injectable for use-case tests. */
export interface TransactionRunner<TDatabase> {
  execute<TResult>(
    work: (transaction: Transaction<TDatabase>) => Promise<TResult>,
  ): Promise<TResult>
}

/**
 * Adapts a Kysely database to {@link TransactionRunner}.
 * The callback result is committed; a thrown/rejected error rolls back and is rethrown.
 */
export function createTransactionRunner<TDatabase>(
  database: Kysely<TDatabase>,
): TransactionRunner<TDatabase> {
  return {
    execute: (work) => database.transaction().execute(work),
  }
}
