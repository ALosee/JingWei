import type { Kysely } from 'kysely'

import { PostgresPlatformAuditWriter } from '@jingwei/audit'
import { ApplicationError, toUserId } from '@jingwei/kernel'

import type {
  ProvisionedTenantIam,
  TenantIamProvisioningStore,
} from '../application/provision-tenant.js'
import type { IamDatabase } from './credential-reader.pg.js'

export class PostgresTenantIamProvisioningStore implements TenantIamProvisioningStore {
  constructor(private readonly database: Kysely<IamDatabase>) {}

  provision(
    input: Parameters<TenantIamProvisioningStore['provision']>[0],
  ): Promise<ProvisionedTenantIam> {
    return this.database.transaction().execute(async (transaction) => {
      const existingRole = await transaction
        .selectFrom('iam.role')
        .select('id')
        .where('tenant_id', '=', input.tenantId)
        .where('code', '=', 'tenant-administrator')
        .forUpdate()
        .executeTakeFirst()
      const assignedAdministrator =
        existingRole === undefined
          ? undefined
          : await transaction
              .selectFrom('iam.user_role as assignment')
              .innerJoin('iam.user as user', 'user.id', 'assignment.user_id')
              .select(['user.id', 'user.username_normalized'])
              .where('assignment.tenant_id', '=', input.tenantId)
              .where('assignment.role_id', '=', existingRole.id)
              .where('user.tenant_id', '=', input.tenantId)
              .orderBy('user.created_at')
              .executeTakeFirst()
      if (
        assignedAdministrator !== undefined &&
        assignedAdministrator.username_normalized !== input.normalizedLogin
      ) {
        throw new ApplicationError({
          code: 'TENANT_ADMIN_RETRY_MISMATCH',
          message: '重试时的管理员账号与已初始化账号不一致',
          status: 409,
        })
      }

      const existingUser =
        assignedAdministrator ??
        (await transaction
          .selectFrom('iam.user')
          .select(['id', 'username_normalized'])
          .where('tenant_id', '=', input.tenantId)
          .where('username_normalized', '=', input.normalizedLogin)
          .forUpdate()
          .executeTakeFirst())
      const userId = toUserId(existingUser?.id ?? input.userId)
      if (existingUser === undefined) {
        await transaction
          .insertInto('iam.user')
          .values({
            id: userId,
            tenant_id: input.tenantId,
            username: input.login,
            username_normalized: input.normalizedLogin,
            email: input.email,
            email_normalized: input.normalizedEmail,
            phone: null,
            display_name: input.displayName,
            avatar: null,
            status: 'ACTIVE',
            last_login_at: null,
            created_at: input.now,
            created_by: userId,
            updated_at: input.now,
            updated_by: userId,
          })
          .execute()
      } else {
        await transaction
          .updateTable('iam.user')
          .set({
            display_name: input.displayName,
            email: input.email,
            email_normalized: input.normalizedEmail,
            status: 'ACTIVE',
            updated_at: input.now,
            updated_by: userId,
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', userId)
          .executeTakeFirstOrThrow()
      }

      await transaction
        .insertInto('iam.user_credential')
        .values({
          user_id: userId,
          password_hash: input.passwordHash,
          password_changed_at: input.now,
          failed_attempts: 0,
          locked_until: null,
          created_at: input.now,
          updated_at: input.now,
        })
        .onConflict((conflict) =>
          conflict.column('user_id').doUpdateSet({
            password_hash: input.passwordHash,
            password_changed_at: input.now,
            failed_attempts: 0,
            locked_until: null,
            updated_at: input.now,
          }),
        )
        .execute()

      const roleId = existingRole?.id ?? input.roleId
      if (existingRole === undefined) {
        await transaction
          .insertInto('iam.role')
          .values({
            id: roleId,
            tenant_id: input.tenantId,
            code: 'tenant-administrator',
            name: '租户管理员',
            description: '租户初始化创建的系统管理员角色',
            status: 'ACTIVE',
            is_system: true,
            is_super: false,
            created_at: input.now,
            created_by: userId,
            updated_at: input.now,
            updated_by: userId,
          })
          .execute()
      }

      await transaction
        .insertInto('iam.user_role')
        .values({
          tenant_id: input.tenantId,
          user_id: userId,
          role_id: roleId,
          created_at: input.now,
          created_by: userId,
        })
        .onConflict((conflict) => conflict.doNothing())
        .execute()
      await transaction
        .deleteFrom('iam.role_permission_org_scope')
        .where('tenant_id', '=', input.tenantId)
        .where('role_id', '=', roleId)
        .execute()
      await transaction
        .deleteFrom('iam.role_permission')
        .where('tenant_id', '=', input.tenantId)
        .where('role_id', '=', roleId)
        .execute()
      if (input.permissions.length > 0) {
        await transaction
          .insertInto('iam.role_permission')
          .values(
            input.permissions.map((permission) => ({
              tenant_id: input.tenantId,
              role_id: roleId,
              permission_code: permission.code,
              scope_type: 'ALL',
              created_at: input.now,
              created_by: userId,
            })),
          )
          .execute()
      }

      await new PostgresPlatformAuditWriter(transaction, () => input.now).appendPlatform({
        context: input.context,
        tenantId: input.tenantId,
        module: 'iam',
        action: 'tenant.initial_administrator_provisioned',
        entityType: 'user',
        entityId: userId,
        result: 'SUCCESS',
        after: {
          username: input.login,
          displayName: input.displayName,
          roleCode: 'tenant-administrator',
          permissionCodes: input.permissions.map((permission) => permission.code),
        },
      })
      return { userId, roleId }
    })
  }
}
