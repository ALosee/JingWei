import type { PlatformAuditContext } from '@jingwei/audit'
import { ApplicationError, type TenantId } from '@jingwei/kernel'
import type { createTenantIamProvisioner } from '@jingwei/module-iam/server/public'
import type { createTenantNavigationProvisioner } from '@jingwei/module-navigation/server/public'
import type { ManageTenants, TenantSnapshot } from '@jingwei/tenancy'

import type { CreatePlatformTenant, RetryPlatformTenant } from '../../shared/index.js'

type IamProvisioner = ReturnType<typeof createTenantIamProvisioner>
type NavigationProvisioner = Pick<ReturnType<typeof createTenantNavigationProvisioner>, 'execute'>
type TenantManagement = Pick<
  ManageTenants,
  | 'reserve'
  | 'get'
  | 'markIamInitialized'
  | 'markNavigationInitialized'
  | 'activate'
  | 'recordProvisioningFailure'
>

export interface TenantProvisioningCoordinator {
  run<T>(tenantId: TenantId, work: () => Promise<T>): Promise<T>
}

/** Synchronous, retryable tenant onboarding owned by the platform control plane. */
export class ProvisionTenant {
  constructor(
    private readonly tenants: TenantManagement,
    private readonly iam: Pick<IamProvisioner, 'execute'>,
    private readonly navigation: NavigationProvisioner,
    private readonly coordinator: TenantProvisioningCoordinator,
  ) {}

  async create(
    context: PlatformAuditContext,
    input: CreatePlatformTenant,
  ): Promise<TenantSnapshot> {
    const tenant = await this.tenants.reserve(context, {
      code: input.code,
      name: input.name,
      defaultLocale: input.defaultLocale,
      defaultTimezone: input.defaultTimezone,
      defaultCurrency: input.defaultCurrency,
    })
    return this.coordinator.run(tenant.id, async () => {
      const current = await this.tenants.get(tenant.id)
      if (current.status === 'ACTIVE') return current
      if (current.status !== 'PROVISIONING') {
        throw new ApplicationError({
          code: 'TENANT_STATE_CONFLICT',
          message: '租户不再处于可初始化状态',
          status: 409,
        })
      }
      return this.provision(context, current, input)
    })
  }

  async retry(
    context: PlatformAuditContext,
    tenantId: TenantId,
    input: RetryPlatformTenant,
  ): Promise<TenantSnapshot> {
    return this.coordinator.run(tenantId, async () => {
      const tenant = await this.tenants.get(tenantId)
      if (tenant.status !== 'PROVISIONING') {
        throw new ApplicationError({
          code: 'TENANT_STATE_CONFLICT',
          message: '只有初始化中的租户可以重试',
          status: 409,
        })
      }
      return this.provision(context, tenant, input)
    })
  }

  private async provision(
    context: PlatformAuditContext,
    tenant: TenantSnapshot,
    input: RetryPlatformTenant,
  ): Promise<TenantSnapshot> {
    try {
      const iam = await this.iam.execute(context, {
        tenantId: tenant.id,
        login: input.adminLogin,
        displayName: input.adminName,
        ...(input.adminEmail === undefined ? {} : { email: input.adminEmail }),
        initialPassword: input.initialPassword,
      })
      await this.tenants.markIamInitialized(context, tenant.id)
      await this.navigation.execute(context, {
        tenantId: tenant.id,
        administratorUserId: iam.userId,
        administratorRoleId: iam.roleId,
      })
      await this.tenants.markNavigationInitialized(context, tenant.id)
      return await this.tenants.activate(context, tenant.id)
    } catch (error) {
      const code = error instanceof ApplicationError ? error.code : 'TENANT_PROVISIONING_FAILED'
      await this.tenants.recordProvisioningFailure(context, tenant.id, code).catch(() => undefined)
      throw error
    }
  }
}
