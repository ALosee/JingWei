import { describe, expect, it, vi } from 'vitest'

import type { PlatformAuditContext } from '@jingwei/audit'
import { newRequestId, newTenantId, newUserId } from '@jingwei/kernel'
import { ModuleRegistry } from '@jingwei/module-sdk'

import type { NavigationVersion } from '../../shared/index.js'
import type { NavigationStore } from './navigation-store.js'
import {
  ProvisionTenantNavigation,
  type TenantNavigationProvisioningTransaction,
} from './provision-tenant-navigation.js'

const tenantId = newTenantId()
const userId = newUserId()
const auditContext: PlatformAuditContext = {
  requestId: newRequestId(),
  actor: { type: 'PLATFORM_OPERATOR', id: 'operator-id' },
}

function registry(): ModuleRegistry {
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
          capabilities: [{ id: 'sample.core', name: 'Sample' }],
          permissions: [{ code: 'sample.view', name: 'View sample' }],
          routeDefinitions: [
            {
              key: 'sample.login',
              page: 'SampleLogin',
              layout: 'blank',
              allowedAccessModes: ['PUBLIC'],
              requiredCapability: 'sample.core',
            },
            {
              key: 'sample.home',
              page: 'SampleHome',
              layout: 'base',
              allowedAccessModes: ['PERMISSION'],
              requiredCapability: 'sample.core',
              requiredPermission: 'sample.view',
            },
          ],
          navigationItems: [
            {
              code: 'sample.login',
              name: 'Login',
              type: 'PAGE',
              parentCode: null,
              routeKey: 'sample.login',
              path: '/signin',
              accessMode: 'PUBLIC',
            },
            {
              code: 'sample.home',
              name: 'Home',
              type: 'MENU',
              parentCode: null,
              routeKey: 'sample.home',
              path: '/home',
              accessMode: 'PERMISSION',
            },
          ],
        },
        enabledCapabilities: new Set(['sample.core']),
      },
    ],
    navigation: {
      authEntryCode: 'sample.login',
      homeCode: 'sample.home',
      containers: [],
      items: [
        {
          code: 'sample.login',
          name: 'Login',
          type: 'PAGE',
          parentCode: null,
          routeKey: 'sample.login',
          path: '/signin',
          accessMode: 'PUBLIC',
        },
        {
          code: 'sample.home',
          name: 'Home',
          type: 'MENU',
          parentCode: null,
          routeKey: 'sample.home',
          path: '/home',
          accessMode: 'PERMISSION',
        },
      ],
    },
  })
}

function createStore(existingVersion: NavigationVersion | null = null) {
  let published = existingVersion
  const insertVersion = vi.fn<NavigationStore['insertVersion']>((_context, _rootId, version) => {
    published = { ...version, status: 'PUBLISHED', publishedAt: new Date().toISOString() }
    return Promise.resolve()
  })
  const replaceRoleCodes = vi.fn<NavigationStore['replaceRoleCodes']>(() => Promise.resolve())
  const store: NavigationStore = {
    root: vi.fn(() =>
      Promise.resolve({ id: 'root-id', publishedVersionId: published?.id ?? null }),
    ),
    ensureRoot: vi.fn(() =>
      Promise.resolve({ id: 'root-id', publishedVersionId: published?.id ?? null }),
    ),
    list: vi.fn(() => Promise.resolve({ publishedVersionId: published?.id ?? null, versions: [] })),
    version: vi.fn(() => Promise.resolve(published)),
    nextRevision: vi.fn(() => Promise.resolve(1)),
    insertVersion,
    saveDraft: vi.fn(() => Promise.resolve()),
    markPublished: vi.fn(() => Promise.resolve()),
    pointPublished: vi.fn(() => Promise.resolve()),
    deleteDraft: vi.fn(() => Promise.resolve()),
    roleCodes: vi.fn(() => Promise.resolve([])),
    replaceRoleCodes,
    loadPublished: vi.fn(() => Promise.resolve(published)),
    grantedCodes: vi.fn(() => Promise.resolve(new Set<string>())),
  }
  return { store, insertVersion, replaceRoleCodes }
}

describe('ProvisionTenantNavigation', () => {
  it('publishes the Edition default and grants its protected entries under platform audit', async () => {
    const { store, insertVersion, replaceRoleCodes } = createStore()
    const recordPlatform = vi.fn<TenantNavigationProvisioningTransaction['recordPlatform']>(() =>
      Promise.resolve(),
    )
    const provisioner = new ProvisionTenantNavigation(
      { run: (work) => work({ store, recordPlatform }) },
      registry(),
    )

    const result = await provisioner.execute(auditContext, {
      tenantId,
      administratorUserId: userId,
      administratorRoleId: 'role-id',
    })

    expect(insertVersion).toHaveBeenCalledWith(
      { tenantId, userId },
      'root-id',
      expect.objectContaining({ status: 'DRAFT' }),
    )
    expect(replaceRoleCodes).toHaveBeenCalledWith({ tenantId, userId }, 'role-id', ['sample.home'])
    expect(recordPlatform).toHaveBeenCalledTimes(2)
    expect(recordPlatform).toHaveBeenCalledWith(
      auditContext,
      tenantId,
      'tenant.default_navigation_published',
      'root-id',
      expect.anything(),
      expect.anything(),
    )
    expect(result.grantedCodes).toEqual(['sample.home'])
  })
})
