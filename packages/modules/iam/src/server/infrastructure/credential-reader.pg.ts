import type { Kysely } from 'kysely'

import { toUserId } from '@jingwei/kernel'

import type { CredentialReader, CredentialSnapshot } from '../application/authenticate-user.js'
import type { UserStatus } from '../domain/user-status.js'

interface UserTable {
  id: string
  tenant_id: string
  username_normalized: string
  email_normalized: string | null
  display_name: string
  status: UserStatus
}

interface CredentialTable {
  user_id: string
  password_hash: string
}

export interface IamDatabase {
  'iam.user': UserTable
  'iam.user_credential': CredentialTable
}

export class PostgresCredentialReader implements CredentialReader {
  constructor(private readonly database: Kysely<IamDatabase>) {}

  async findByLogin(tenantId: string, normalizedLogin: string): Promise<CredentialSnapshot | null> {
    const row = await this.database
      .selectFrom('iam.user as user')
      .innerJoin('iam.user_credential as credential', 'credential.user_id', 'user.id')
      .select(['user.id', 'user.display_name', 'user.status', 'credential.password_hash'])
      .where('user.tenant_id', '=', tenantId)
      .where((expression) =>
        expression.or([
          expression('user.username_normalized', '=', normalizedLogin),
          expression('user.email_normalized', '=', normalizedLogin),
        ]),
      )
      .executeTakeFirst()

    return row === undefined
      ? null
      : {
          userId: toUserId(row.id),
          displayName: row.display_name,
          status: row.status,
          passwordHash: row.password_hash,
        }
  }
}
