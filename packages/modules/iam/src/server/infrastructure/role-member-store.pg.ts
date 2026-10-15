import { createHash } from 'node:crypto'

import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type { RoleMemberQuery } from '../../shared/index.js'
import type {
  RoleMemberStore,
  RoleMemberTransaction,
  RoleMemberUnitOfWork,
} from '../application/role-member-store.js'
import { activeManagerQuery } from './active-manager-query.pg.js'
import { lockIamAdministration } from './administration-lock.pg.js'
import type { IamDatabase } from './credential-reader.pg.js'

export class PostgresRoleMemberStore implements RoleMemberStore {
  constructor(private readonly database: Kysely<IamDatabase>) {}

  lockAdministration(tenantId: TenantId) {
    return lockIamAdministration(this.database, tenantId)
  }

  async lockRole(tenantId: TenantId, roleId: string) {
    return (
      (await this.database
        .selectFrom('iam.role')
        .select('status')
        .where('tenant_id', '=', tenantId)
        .where('id', '=', roleId)
        .forUpdate()
        .executeTakeFirst()) ?? null
    )
  }

  async snapshot(tenantId: TenantId, roleId: string) {
    const rows = await this.database
      .selectFrom('iam.user_role')
      .select('user_id')
      .where('tenant_id', '=', tenantId)
      .where('role_id', '=', roleId)
      .orderBy('user_id')
      .execute()
    const userIds = rows.map((row) => row.user_id)
    // UUIDs are fixed-length; role and tenant also bind the confirmation to its intended target.
    const snapshot = createHash('sha256')
      .update(JSON.stringify([tenantId, roleId, userIds]))
      .digest('hex')
    return { userIds, snapshot }
  }

  async list(tenantId: TenantId, roleId: string, query: RoleMemberQuery, candidates: boolean) {
    let source = this.database
      .selectFrom('iam.user as user')
      .where('user.tenant_id', '=', tenantId)
      .where((eb) => {
        const membership = eb
          .selectFrom('iam.user_role')
          .select('user_id')
          .where('tenant_id', '=', tenantId)
          .where('role_id', '=', roleId)
          .whereRef('user_id', '=', 'user.id')
        return candidates ? eb.not(eb.exists(membership)) : eb.exists(membership)
      })
    if (candidates) source = source.where('user.status', '=', 'ACTIVE')
    if (query.search !== '') {
      const pattern =
        '%' +
        query.search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_') +
        '%'
      source = source.where((eb) =>
        eb.or([eb('user.username', 'ilike', pattern), eb('user.display_name', 'ilike', pattern)]),
      )
    }
    const count = await source
      .select(({ fn }) => fn.count<string>('user.id').as('total'))
      .executeTakeFirst()
    const members = await source
      .select(['user.id', 'user.username', 'user.display_name as displayName', 'user.status'])
      .orderBy('user.username')
      .orderBy('user.id')
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute()
    return { members, total: Number(count?.total ?? 0) }
  }

  async lockActiveUsers(tenantId: TenantId, userIds: readonly string[]) {
    const rows = await this.database
      .selectFrom('iam.user')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('id', 'in', [...userIds])
      .where('status', '=', 'ACTIVE')
      .orderBy('id')
      .forShare()
      .execute()
    return rows.map((row) => row.id)
  }

  async add(
    context: ApplicationContext,
    roleId: string,
    userIds: readonly string[],
  ): Promise<void> {
    await this.database
      .insertInto('iam.user_role')
      .values(
        userIds.map((userId) => ({
          tenant_id: context.tenantId,
          user_id: userId,
          role_id: roleId,
          created_at: new Date(),
          created_by: context.userId,
        })),
      )
      .execute()
  }

  async remove(
    context: ApplicationContext,
    roleId: string,
    userIds: readonly string[],
  ): Promise<void> {
    await this.database
      .deleteFrom('iam.user_role')
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', '=', roleId)
      .where('user_id', 'in', [...userIds])
      .execute()
  }

  async clear(context: ApplicationContext, roleId: string): Promise<void> {
    await this.database
      .deleteFrom('iam.user_role')
      .where('tenant_id', '=', context.tenantId)
      .where('role_id', '=', roleId)
      .execute()
  }

  async hasActiveManager(tenantId: TenantId): Promise<boolean> {
    return (
      (await activeManagerQuery(this.database, tenantId).select('user.id').executeTakeFirst()) !==
      undefined
    )
  }
}

export class PostgresRoleMemberUnitOfWork implements RoleMemberUnitOfWork {
  constructor(private readonly database: Kysely<IamDatabase>) {}
  run<T>(work: (transaction: RoleMemberTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction().execute((transaction) =>
      work({
        store: new PostgresRoleMemberStore(transaction),
        record: async (context, action, roleId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'iam',
            action,
            entityType: 'role',
            entityId: roleId,
            result: 'SUCCESS',
            before,
            after,
          })
        },
      }),
    )
  }
}
