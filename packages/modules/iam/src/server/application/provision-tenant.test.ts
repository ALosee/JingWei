import { describe, expect, it, vi } from 'vitest'

import type { PlatformAuditContext } from '@jingwei/audit'
import type { PasswordHasher } from '@jingwei/auth'
import { newRequestId, newTenantId, type Clock } from '@jingwei/kernel'
import { ModuleRegistry } from '@jingwei/module-sdk'

import { ProvisionTenantIam, type TenantIamProvisioningStore } from './provision-tenant.js'

const now = new Date('2026-09-20T08:00:00.000Z')
const context: PlatformAuditContext = {
  requestId: newRequestId(),
  actor: { type: 'CLI', id: 'operator@example.com' },
}

function registry(
  allowedTypes: readonly ['ALL' | 'SELF', ...('ALL' | 'SELF')[]] = ['ALL'],
): ModuleRegistry {
  return new ModuleRegistry({
    id: 'test',
    modules: [
      {
        manifest: {
          id: 'sample',
          name: 'Sample',
          category: 'foundation',
          dependencies: [],
          optionalDependencies: [],
          capabilities: [],
          permissions: [
            {
              code: 'sample.view',
              name: 'View sample',
              dataScope: { allowedTypes },
            },
          ],
          routeDefinitions: [],
        },
        enabledCapabilities: new Set(),
      },
    ],
  })
}

function createProvisioner(permissionRegistry = registry()) {
  const provision = vi.fn<TenantIamProvisioningStore['provision']>((input) =>
    Promise.resolve({ userId: input.userId, roleId: input.roleId }),
  )
  const hash = vi.fn(() => Promise.resolve('argon2id-hash'))
  const passwords: PasswordHasher = {
    hash,
    verify: vi.fn(() => Promise.resolve(true)),
  }
  const clock: Clock = { now: () => now }
  return {
    provisioner: new ProvisionTenantIam({ provision }, permissionRegistry, passwords, clock),
    provision,
    hash,
  }
}

describe('ProvisionTenantIam', () => {
  it('hashes the secret and projects all Edition permissions for the initial administrator', async () => {
    const harness = createProvisioner()
    const tenantId = newTenantId()

    await harness.provisioner.execute(context, {
      tenantId,
      login: ' Admin ',
      displayName: ' 租户管理员 ',
      email: 'ADMIN@EXAMPLE.COM',
      initialPassword: 'initial-secret',
    })

    expect(harness.hash).toHaveBeenCalledWith('initial-secret')
    expect(harness.provision).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        tenantId,
        login: 'Admin',
        normalizedLogin: 'admin',
        displayName: '租户管理员',
        email: 'ADMIN@EXAMPLE.COM',
        normalizedEmail: 'admin@example.com',
        passwordHash: 'argon2id-hash',
        now,
        permissions: [{ code: 'sample.view' }],
      }),
    )
  })

  it('rejects invalid administrator input before hashing the password', async () => {
    const harness = createProvisioner()

    await expect(
      harness.provisioner.execute(context, {
        tenantId: newTenantId(),
        login: 'admin',
        displayName: 'Admin',
        email: 'not-an-email',
        initialPassword: 'initial-secret',
      }),
    ).rejects.toMatchObject({ code: 'TENANT_ADMIN_EMAIL_INVALID' })
    expect(harness.hash).not.toHaveBeenCalled()
  })

  it('fails closed when an Edition permission cannot be granted with ALL scope', async () => {
    const harness = createProvisioner(registry(['SELF']))

    await expect(
      harness.provisioner.execute(context, {
        tenantId: newTenantId(),
        login: 'admin',
        displayName: 'Admin',
        initialPassword: 'initial-secret',
      }),
    ).rejects.toMatchObject({ code: 'TENANT_ADMIN_PERMISSION_SCOPE_UNSUPPORTED' })
    expect(harness.provision).not.toHaveBeenCalled()
    expect(harness.hash).not.toHaveBeenCalled()
  })
})
