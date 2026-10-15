import { sql, type Kysely } from 'kysely'

import type { TenantId } from '@jingwei/kernel'

/** Serializes tenant IAM writes so last-manager checks cannot both pass concurrently. */
export async function lockIamAdministration<TDatabase>(
  database: Kysely<TDatabase>,
  tenantId: TenantId,
): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`iam:administration:${tenantId}`}, 0))`.execute(
    database,
  )
}
