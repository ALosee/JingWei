import { expect, it, vi } from 'vitest'

import type { NavigationResponse } from '@jingwei/module-navigation/shared'

import { loadTenantNavigationBootstrap } from './tenant-bootstrap.js'

const navigation: NavigationResponse = {
  schemaVersion: 2,
  versionId: '11111111-1111-7111-8111-111111111111',
  publishedRevision: 1,
  authEntryCode: 'iam.login',
  homeCode: null,
  nodes: [],
}

it('loads public navigation for the hinted tenant', async () => {
  const load = vi.fn(() => Promise.resolve(navigation))

  await expect(loadTenantNavigationBootstrap('hunanzhonghang', load)).resolves.toBe(navigation)
  expect(load).toHaveBeenCalledWith('hunanzhonghang')
  expect(load).toHaveBeenCalledOnce()
})

it('falls back to the deployment bootstrap tenant when a stored tenant is unavailable', async () => {
  const load = vi.fn((tenantCode?: string) =>
    tenantCode === undefined
      ? Promise.resolve(navigation)
      : Promise.reject(new Error('unavailable')),
  )

  await expect(loadTenantNavigationBootstrap('removed-tenant', load)).resolves.toBe(navigation)
  expect(load.mock.calls).toEqual([['removed-tenant'], []])
})
