import { describe, expect, it, vi } from 'vitest'

import type { PlatformAuditContext } from '@jingwei/audit'
import { newEntityId, newRequestId, newTenantId, newUserId, type TenantId } from '@jingwei/kernel'
import type { TenantSnapshot } from '@jingwei/tenancy'

import { ProvisionTenant, type TenantProvisioningCoordinator } from './provision-tenant.js'

const context: PlatformAuditContext = {
  requestId: newRequestId(),
  actor: { type: 'PLATFORM_OPERATOR', id: newEntityId() },
  ipAddress: '192.0.2.10',
  userAgent: 'test-agent',
}
const tenant: TenantSnapshot = {
  id: newTenantId(),
  code: 'hunan',
  name: '湖南中航',
  status: 'PROVISIONING',
  defaultLocale: 'zh-CN',
  defaultTimezone: 'Asia/Shanghai',
  defaultCurrency: 'CNY',
  version: 1,
  provisioningStep: 'TENANT_RESERVED',
  provisioningErrorCode: null,
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
}

describe('ProvisionTenant', () => {
  it('serializes onboarding and passes the platform actor through every provisioning port', async () => {
    const administratorUserId = newUserId()
    const administratorRoleId = newEntityId()
    const active = { ...tenant, status: 'ACTIVE' as const, provisioningStep: 'COMPLETED' as const }
    const reserve = vi.fn(() => Promise.resolve(tenant))
    const get = vi.fn(() => Promise.resolve(tenant))
    const markIamInitialized = vi.fn(() => Promise.resolve(tenant))
    const markNavigationInitialized = vi.fn(() => Promise.resolve(tenant))
    const activate = vi.fn(() => Promise.resolve(active))
    const recordProvisioningFailure = vi.fn(() => Promise.resolve(tenant))
    const iamExecute = vi.fn(() =>
      Promise.resolve({ userId: administratorUserId, roleId: administratorRoleId }),
    )
    const navigationExecute = vi.fn(() =>
      Promise.resolve({ publishedVersionId: newEntityId(), grantedCodes: ['iam.roles'] }),
    )
    let coordinatedTenantId: TenantId | null = null
    const coordinator: TenantProvisioningCoordinator = {
      run<T>(tenantId: TenantId, work: () => Promise<T>): Promise<T> {
        coordinatedTenantId = tenantId
        return work()
      },
    }
    const provision = new ProvisionTenant(
      {
        reserve,
        get,
        markIamInitialized,
        markNavigationInitialized,
        activate,
        recordProvisioningFailure,
      },
      { execute: iamExecute },
      { execute: navigationExecute },
      coordinator,
    )

    await expect(
      provision.create(context, {
        code: tenant.code,
        name: tenant.name,
        defaultLocale: tenant.defaultLocale,
        defaultTimezone: tenant.defaultTimezone,
        defaultCurrency: tenant.defaultCurrency,
        adminLogin: 'admin',
        adminName: '系统管理员',
        initialPassword: 'initial-secret',
      }),
    ).resolves.toEqual(active)

    expect(coordinatedTenantId).toBe(tenant.id)
    expect(get).toHaveBeenCalledWith(tenant.id)
    expect(iamExecute).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ tenantId: tenant.id, login: 'admin' }),
    )
    expect(navigationExecute).toHaveBeenCalledWith(context, {
      tenantId: tenant.id,
      administratorUserId,
      administratorRoleId,
    })
    expect(markIamInitialized).toHaveBeenCalledWith(context, tenant.id)
    expect(markNavigationInitialized).toHaveBeenCalledWith(context, tenant.id)
    expect(activate).toHaveBeenCalledWith(context, tenant.id)
    expect(recordProvisioningFailure).not.toHaveBeenCalled()
  })
})
