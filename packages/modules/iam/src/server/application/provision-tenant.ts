import { z } from 'zod'

import type { PlatformAuditContext } from '@jingwei/audit'
import type { PasswordHasher } from '@jingwei/auth'
import {
  ApplicationError,
  newEntityId,
  newUserId,
  type Clock,
  type TenantId,
  type UserId,
} from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

export interface ProvisionInitialAdministratorInput {
  readonly tenantId: TenantId
  readonly login: string
  readonly displayName: string
  readonly email?: string
  readonly initialPassword: string
}

export interface ProvisionedTenantIam {
  readonly userId: UserId
  readonly roleId: string
}

export interface TenantIamProvisioningStore {
  provision(input: {
    readonly context: PlatformAuditContext
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly roleId: string
    readonly login: string
    readonly normalizedLogin: string
    readonly displayName: string
    readonly email: string | null
    readonly normalizedEmail: string | null
    readonly passwordHash: string
    readonly permissions: readonly {
      readonly code: string
    }[]
    readonly now: Date
  }): Promise<ProvisionedTenantIam>
}

/** Idempotent IAM initializer used only while the tenant is PROVISIONING. */
export class ProvisionTenantIam {
  constructor(
    private readonly store: TenantIamProvisioningStore,
    private readonly registry: ModuleRegistry,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(
    context: PlatformAuditContext,
    input: ProvisionInitialAdministratorInput,
  ): Promise<ProvisionedTenantIam> {
    const login = input.login.trim()
    const displayName = input.displayName.trim()
    const trimmedEmail = input.email?.trim()
    const email = trimmedEmail === undefined || trimmedEmail.length === 0 ? null : trimmedEmail
    if (login.length === 0 || login.length > 120)
      fail('TENANT_ADMIN_LOGIN_INVALID', '初始管理员账号长度不正确')
    if (displayName.length === 0 || displayName.length > 160)
      fail('TENANT_ADMIN_NAME_INVALID', '初始管理员名称长度不正确')
    if (email !== null && !z.email().max(320).safeParse(email).success) {
      fail('TENANT_ADMIN_EMAIL_INVALID', '初始管理员邮箱格式不正确')
    }
    if (input.initialPassword.length < 12 || input.initialPassword.length > 1_024) {
      fail('TENANT_ADMIN_PASSWORD_INVALID', '初始管理员密码长度必须为 12 到 1024 个字符')
    }
    const permissions = this.registry.permissions().map((permission) => {
      if (!(permission.dataScope?.allowedTypes ?? ['ALL']).includes('ALL')) {
        fail(
          'TENANT_ADMIN_PERMISSION_SCOPE_UNSUPPORTED',
          `权限 ${permission.code} 不允许 ALL，不能自动授予租户管理员`,
        )
      }
      return {
        code: permission.code,
      }
    })
    return this.store.provision({
      context,
      tenantId: input.tenantId,
      userId: newUserId(),
      roleId: newEntityId(),
      login,
      normalizedLogin: normalize(login),
      displayName,
      email,
      normalizedEmail: email === null ? null : normalize(email),
      passwordHash: await this.passwords.hash(input.initialPassword),
      permissions,
      now: this.clock.now(),
    })
  }
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('en-US')
}

function fail(code: string, message: string): never {
  throw new ApplicationError({ code, message, status: 400 })
}
