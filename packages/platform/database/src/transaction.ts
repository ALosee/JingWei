import type { Kysely, Transaction } from 'kysely'

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
