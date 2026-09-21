import type { PlatformAuditContext } from '@jingwei/audit'
import type { PasswordHasher } from '@jingwei/auth'
import { ApplicationError, newOperatorId, type Clock, type OperatorId } from '@jingwei/kernel'

import type { PlatformOperator } from '../../shared/index.js'

export interface BootstrapOperatorStore {
  createInitial(input: {
    readonly context: PlatformAuditContext
    readonly id: OperatorId
    readonly login: string
    readonly normalizedLogin: string
    readonly displayName: string
    readonly passwordHash: string
    readonly now: Date
  }): Promise<PlatformOperator>
}

export class BootstrapPlatformOperator {
  constructor(
    private readonly store: BootstrapOperatorStore,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(
    context: PlatformAuditContext,
    input: { readonly login: string; readonly displayName: string; readonly password: string },
  ): Promise<PlatformOperator> {
    const login = input.login.trim()
    const displayName = input.displayName.trim()
    if (login.length === 0 || login.length > 120)
      fail('PLATFORM_OPERATOR_LOGIN_INVALID', '账号长度不正确')
    if (displayName.length === 0 || displayName.length > 160) {
      fail('PLATFORM_OPERATOR_NAME_INVALID', '名称长度不正确')
    }
    if (input.password.length < 12 || input.password.length > 1_024) {
      fail('PLATFORM_OPERATOR_PASSWORD_INVALID', '密码长度必须为 12 到 1024 个字符')
    }
    return this.store.createInitial({
      context,
      id: newOperatorId(),
      login,
      normalizedLogin: login.toLocaleLowerCase('en-US'),
      displayName,
      passwordHash: await this.passwords.hash(input.password),
      now: this.clock.now(),
    })
  }
}

function fail(code: string, message: string): never {
  throw new ApplicationError({ code, message, status: 400 })
}
