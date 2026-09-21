import type { PlatformAuditContext } from '@jingwei/audit'
import { ApplicationError, newTenantId, type Clock, type TenantId } from '@jingwei/kernel'

import { normalizeTenantCode } from '../directory.js'
import type {
  CreateTenantInput,
  TenantProvisioningStep,
  TenantSnapshot,
  TenantStatus,
} from '../model.js'

export interface TenantStore {
  list(): Promise<readonly TenantSnapshot[]>
  findByCode(code: string, lock?: boolean): Promise<TenantSnapshot | null>
  get(id: TenantId, lock?: boolean): Promise<TenantSnapshot | null>
  insert(tenant: TenantSnapshot): Promise<void>
  update(
    id: TenantId,
    expectedVersion: number,
    patch: {
      readonly status?: TenantStatus
      readonly provisioningStep?: TenantProvisioningStep
      readonly provisioningErrorCode?: string | null
      readonly updatedAt: Date
    },
  ): Promise<void>
}

export interface TenantTransaction {
  readonly store: TenantStore
  record(
    context: PlatformAuditContext,
    tenantId: TenantId,
    action: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface TenantUnitOfWork {
  run<TResult>(work: (transaction: TenantTransaction) => Promise<TResult>): Promise<TResult>
}

export interface TenantSessionRevoker {
  revokeTenant(tenantId: TenantId): Promise<void>
}

export class ManageTenants {
  constructor(
    private readonly store: TenantStore,
    private readonly work: TenantUnitOfWork,
    private readonly sessions: TenantSessionRevoker,
    private readonly clock: Clock,
  ) {}

  list(): Promise<readonly TenantSnapshot[]> {
    return this.store.list()
  }

  async getByCode(code: string): Promise<TenantSnapshot> {
    const tenant = await this.store.findByCode(normalizeTenantCode(code))
    if (tenant === null) fail('TENANT_NOT_FOUND', '租户不存在', 404)
    return tenant
  }

  async get(id: TenantId): Promise<TenantSnapshot> {
    return requiredTenant(this.store, id, false)
  }

  reserve(context: PlatformAuditContext, input: CreateTenantInput): Promise<TenantSnapshot> {
    const normalized = validateCreateInput(input)
    return this.work.run(async (transaction) => {
      if ((await transaction.store.findByCode(normalized.code, true)) !== null) {
        fail('TENANT_CODE_CONFLICT', '租户代码已存在')
      }
      const now = this.clock.now()
      const tenant: TenantSnapshot = {
        id: newTenantId(),
        ...normalized,
        status: 'PROVISIONING',
        version: 1,
        provisioningStep: 'TENANT_RESERVED',
        provisioningErrorCode: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await transaction.store.insert(tenant)
      await transaction.record(context, tenant.id, 'tenant.created', null, tenantAuditView(tenant))
      return tenant
    })
  }

  markIamInitialized(context: PlatformAuditContext, id: TenantId): Promise<TenantSnapshot> {
    return this.advanceProvisioning(context, id, 'IAM_INITIALIZED')
  }

  markNavigationInitialized(context: PlatformAuditContext, id: TenantId): Promise<TenantSnapshot> {
    return this.advanceProvisioning(context, id, 'NAVIGATION_INITIALIZED')
  }

  activate(context: PlatformAuditContext, id: TenantId): Promise<TenantSnapshot> {
    return this.work.run(async (transaction) => {
      const current = await requiredTenant(transaction.store, id, true)
      if (current.status !== 'PROVISIONING') {
        fail('TENANT_STATE_CONFLICT', '只有初始化中的租户可以激活')
      }
      if (current.provisioningStep !== 'NAVIGATION_INITIALIZED') {
        fail('TENANT_PROVISIONING_INCOMPLETE', '租户初始化步骤尚未完成')
      }
      const updated = await updateTenant(transaction.store, current, this.clock.now(), {
        status: 'ACTIVE',
        provisioningStep: 'COMPLETED',
        provisioningErrorCode: null,
      })
      await transaction.record(
        context,
        id,
        'tenant.activated',
        tenantAuditView(current),
        tenantAuditView(updated),
      )
      return updated
    })
  }

  recordProvisioningFailure(
    context: PlatformAuditContext,
    id: TenantId,
    errorCode: string,
  ): Promise<TenantSnapshot> {
    return this.work.run(async (transaction) => {
      const current = await requiredTenant(transaction.store, id, true)
      if (current.status !== 'PROVISIONING') return current
      const updated = await updateTenant(transaction.store, current, this.clock.now(), {
        provisioningErrorCode: safeErrorCode(errorCode),
      })
      await transaction.record(
        context,
        id,
        'tenant.provisioning_failed',
        tenantAuditView(current),
        tenantAuditView(updated),
      )
      return updated
    })
  }

  suspend(context: PlatformAuditContext, id: TenantId): Promise<TenantSnapshot> {
    return this.transitionAndRevoke(context, id, 'ACTIVE', 'SUSPENDED', 'tenant.suspended')
  }

  resume(context: PlatformAuditContext, id: TenantId): Promise<TenantSnapshot> {
    return this.transition(context, id, 'SUSPENDED', 'ACTIVE', 'tenant.resumed')
  }

  disable(context: PlatformAuditContext, id: TenantId): Promise<TenantSnapshot> {
    return this.disableAndRevoke(context, id)
  }

  private advanceProvisioning(
    context: PlatformAuditContext,
    id: TenantId,
    step: Extract<TenantProvisioningStep, 'IAM_INITIALIZED' | 'NAVIGATION_INITIALIZED'>,
  ): Promise<TenantSnapshot> {
    return this.work.run(async (transaction) => {
      const current = await requiredTenant(transaction.store, id, true)
      if (current.status !== 'PROVISIONING') {
        fail('TENANT_STATE_CONFLICT', '租户不处于初始化状态')
      }
      if (step === 'IAM_INITIALIZED' && current.provisioningStep === 'NAVIGATION_INITIALIZED') {
        return current
      }
      const requiredPrevious = step === 'IAM_INITIALIZED' ? 'TENANT_RESERVED' : 'IAM_INITIALIZED'
      if (current.provisioningStep !== requiredPrevious && current.provisioningStep !== step) {
        fail('TENANT_PROVISIONING_SEQUENCE_INVALID', '租户初始化步骤顺序不正确')
      }
      if (current.provisioningStep === step && current.provisioningErrorCode === null)
        return current
      const updated = await updateTenant(transaction.store, current, this.clock.now(), {
        provisioningStep: step,
        provisioningErrorCode: null,
      })
      await transaction.record(
        context,
        id,
        'tenant.provisioning_advanced',
        tenantAuditView(current),
        tenantAuditView(updated),
      )
      return updated
    })
  }

  private async transitionAndRevoke(
    context: PlatformAuditContext,
    id: TenantId,
    from: TenantStatus,
    to: TenantStatus,
    action: string,
  ): Promise<TenantSnapshot> {
    const updated = await this.transition(context, id, from, to, action)
    await this.sessions.revokeTenant(id)
    return updated
  }

  private async disableAndRevoke(
    context: PlatformAuditContext,
    id: TenantId,
  ): Promise<TenantSnapshot> {
    const updated = await this.work.run(async (transaction) => {
      const current = await requiredTenant(transaction.store, id, true)
      if (current.status !== 'SUSPENDED' && current.status !== 'PROVISIONING') {
        fail('TENANT_STATE_CONFLICT', '只有已暂停或初始化中的租户可以停用')
      }
      const next = await updateTenant(transaction.store, current, this.clock.now(), {
        status: 'DISABLED',
      })
      await transaction.record(
        context,
        id,
        'tenant.disabled',
        tenantAuditView(current),
        tenantAuditView(next),
      )
      return next
    })
    await this.sessions.revokeTenant(id)
    return updated
  }

  private transition(
    context: PlatformAuditContext,
    id: TenantId,
    from: TenantStatus,
    to: TenantStatus,
    action: string,
  ): Promise<TenantSnapshot> {
    return this.work.run(async (transaction) => {
      const current = await requiredTenant(transaction.store, id, true)
      if (current.status !== from) fail('TENANT_STATE_CONFLICT', `租户当前状态不是 ${from}`)
      const updated = await updateTenant(transaction.store, current, this.clock.now(), {
        status: to,
      })
      await transaction.record(
        context,
        id,
        action,
        tenantAuditView(current),
        tenantAuditView(updated),
      )
      return updated
    })
  }
}

async function requiredTenant(store: TenantStore, id: TenantId, lock: boolean) {
  const tenant = await store.get(id, lock)
  if (tenant === null) fail('TENANT_NOT_FOUND', '租户不存在', 404)
  return tenant
}

async function updateTenant(
  store: TenantStore,
  current: TenantSnapshot,
  now: Date,
  patch: Omit<Parameters<TenantStore['update']>[2], 'updatedAt'>,
): Promise<TenantSnapshot> {
  await store.update(current.id, current.version, { ...patch, updatedAt: now })
  return requiredTenant(store, current.id, false)
}

function validateCreateInput(
  input: CreateTenantInput,
): Omit<
  TenantSnapshot,
  | 'id'
  | 'status'
  | 'version'
  | 'provisioningStep'
  | 'provisioningErrorCode'
  | 'createdAt'
  | 'updatedAt'
> {
  const code = normalizeTenantCode(input.code)
  const name = input.name.trim()
  const defaultLocale = input.defaultLocale.trim()
  const defaultTimezone = input.defaultTimezone.trim()
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase()
  if (!/^[a-z][a-z0-9-]{0,62}$/u.test(code)) {
    fail(
      'TENANT_CODE_INVALID',
      '租户代码必须以小写字母开头，并且只能包含小写字母、数字和连字符',
      400,
    )
  }
  if (name.length === 0 || name.length > 200) fail('TENANT_NAME_INVALID', '租户名称长度不正确', 400)
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(defaultLocale)) {
    fail('TENANT_LOCALE_INVALID', '默认语言格式不正确', 400)
  }
  if (!/^[A-Z]{3}$/u.test(defaultCurrency)) {
    fail('TENANT_CURRENCY_INVALID', '默认币种必须是三位大写代码', 400)
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: defaultTimezone }).format()
  } catch {
    fail('TENANT_TIMEZONE_INVALID', '默认时区不是有效的 IANA 时区', 400)
  }
  return { code, name, defaultLocale, defaultTimezone, defaultCurrency }
}

function safeErrorCode(value: string): string {
  const code = value.trim().slice(0, 120)
  return /^[A-Z][A-Z0-9_]*$/u.test(code) ? code : 'TENANT_PROVISIONING_FAILED'
}

function tenantAuditView(tenant: TenantSnapshot) {
  return {
    code: tenant.code,
    name: tenant.name,
    status: tenant.status,
    version: tenant.version,
    provisioningStep: tenant.provisioningStep,
    provisioningErrorCode: tenant.provisioningErrorCode,
  }
}

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}
