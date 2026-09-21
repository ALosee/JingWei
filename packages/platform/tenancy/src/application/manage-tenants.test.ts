import { describe, expect, it, vi } from 'vitest'

import type { PlatformAuditContext } from '@jingwei/audit'
import { newRequestId, type Clock, type TenantId } from '@jingwei/kernel'

import type { TenantSnapshot } from '../model.js'
import {
  ManageTenants,
  type TenantStore,
  type TenantTransaction,
  type TenantUnitOfWork,
} from './manage-tenants.js'

const now = new Date('2026-09-20T08:00:00.000Z')
const context: PlatformAuditContext = {
  requestId: newRequestId(),
  actor: { type: 'CLI', id: 'operator@example.com' },
}

function createHarness() {
  const tenants = new Map<TenantId, TenantSnapshot>()
  const records: { action: string; tenantId: TenantId }[] = []
  const store: TenantStore = {
    list: () => Promise.resolve([...tenants.values()]),
    findByCode: (code) =>
      Promise.resolve([...tenants.values()].find((tenant) => tenant.code === code) ?? null),
    get: (id) => Promise.resolve(tenants.get(id) ?? null),
    insert: (tenant) => {
      tenants.set(tenant.id, tenant)
      return Promise.resolve()
    },
    update: (id, expectedVersion, patch) => {
      const current = tenants.get(id)
      if (current?.version !== expectedVersion) {
        return Promise.reject(new Error('optimistic conflict'))
      }
      tenants.set(id, {
        ...current,
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.provisioningStep === undefined
          ? {}
          : { provisioningStep: patch.provisioningStep }),
        ...(patch.provisioningErrorCode === undefined
          ? {}
          : { provisioningErrorCode: patch.provisioningErrorCode }),
        version: expectedVersion + 1,
        updatedAt: patch.updatedAt.toISOString(),
      })
      return Promise.resolve()
    },
  }
  const transaction: TenantTransaction = {
    store,
    record: (_context, tenantId, action) => {
      records.push({ action, tenantId })
      return Promise.resolve()
    },
  }
  const work: TenantUnitOfWork = { run: (operation) => operation(transaction) }
  const revokeTenant = vi.fn(() => Promise.resolve())
  const clock: Clock = { now: () => now }
  return {
    management: new ManageTenants(store, work, { revokeTenant }, clock),
    records,
    revokeTenant,
  }
}

async function reserve(harness: ReturnType<typeof createHarness>) {
  return harness.management.reserve(context, {
    code: ' Acme ',
    name: 'Acme 公司',
    defaultLocale: 'zh-CN',
    defaultTimezone: 'Asia/Shanghai',
    defaultCurrency: 'cny',
  })
}

describe('ManageTenants', () => {
  it('reserves a normalized, non-loginable tenant with an audit record', async () => {
    const harness = createHarness()
    const tenant = await reserve(harness)

    expect(tenant).toMatchObject({
      code: 'acme',
      status: 'PROVISIONING',
      defaultCurrency: 'CNY',
      provisioningStep: 'TENANT_RESERVED',
      version: 1,
    })
    expect(harness.records).toEqual([{ action: 'tenant.created', tenantId: tenant.id }])
  })

  it('rejects duplicate tenant codes after normalization', async () => {
    const harness = createHarness()
    await reserve(harness)
    await expect(reserve(harness)).rejects.toMatchObject({
      code: 'TENANT_CODE_CONFLICT',
    })
  })

  it('requires all provisioning steps before activation', async () => {
    const harness = createHarness()
    const tenant = await reserve(harness)

    await expect(harness.management.activate(context, tenant.id)).rejects.toMatchObject({
      code: 'TENANT_PROVISIONING_INCOMPLETE',
    })
    await harness.management.markIamInitialized(context, tenant.id)
    await harness.management.markNavigationInitialized(context, tenant.id)
    await expect(harness.management.activate(context, tenant.id)).resolves.toMatchObject({
      status: 'ACTIVE',
      provisioningStep: 'COMPLETED',
      provisioningErrorCode: null,
    })
  })

  it('rejects skipped provisioning steps and never regresses a completed step', async () => {
    const harness = createHarness()
    const tenant = await reserve(harness)

    await expect(
      harness.management.markNavigationInitialized(context, tenant.id),
    ).rejects.toMatchObject({ code: 'TENANT_PROVISIONING_SEQUENCE_INVALID' })
    await harness.management.markIamInitialized(context, tenant.id)
    const navigationReady = await harness.management.markNavigationInitialized(context, tenant.id)
    await expect(harness.management.markIamInitialized(context, tenant.id)).resolves.toEqual(
      navigationReady,
    )
  })

  it('suspends an active tenant and revokes all of its sessions', async () => {
    const harness = createHarness()
    const tenant = await reserve(harness)
    await harness.management.markIamInitialized(context, tenant.id)
    await harness.management.markNavigationInitialized(context, tenant.id)
    await harness.management.activate(context, tenant.id)

    await expect(harness.management.suspend(context, tenant.id)).resolves.toMatchObject({
      status: 'SUSPENDED',
    })
    expect(harness.revokeTenant).toHaveBeenCalledWith(tenant.id)
    await expect(harness.management.resume(context, tenant.id)).resolves.toMatchObject({
      status: 'ACTIVE',
    })
  })

  it('stores only a stable safe error code for provisioning failures', async () => {
    const harness = createHarness()
    const tenant = await reserve(harness)
    await expect(
      harness.management.recordProvisioningFailure(context, tenant.id, 'driver said password=x'),
    ).resolves.toMatchObject({ provisioningErrorCode: 'TENANT_PROVISIONING_FAILED' })
  })
})
