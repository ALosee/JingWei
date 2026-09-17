import { describe, expect, it } from 'vitest'

import { ApplicationError } from '@jingwei/kernel'
import { ModuleRegistry, type ResolvedEdition } from '@jingwei/module-sdk'

import { assertUnscopedPermissionAvailable } from './navigation-access.pg.js'

function registry(): ModuleRegistry {
  const edition: ResolvedEdition = {
    id: 'authorization-entry-test',
    modules: [
      {
        manifest: {
          id: 'sample',
          name: 'Sample',
          category: 'foundation',
          dependencies: [],
          optionalDependencies: [],
          capabilities: [{ id: 'sample.core', name: 'Core' }],
          dataScopeProviders: [{ id: 'sample-scope' }],
          permissions: [
            { code: 'sample.manage', name: 'Manage' },
            {
              code: 'sample.view',
              name: 'View',
              dataScope: {
                allowedTypes: ['ALL', 'CUSTOM'],
                provider: 'sample-scope',
              },
            },
          ],
          routeDefinitions: [],
        },
        enabledCapabilities: new Set(['sample.core']),
      },
    ],
  }
  return new ModuleRegistry(edition)
}

describe('unscoped authorization entry', () => {
  it('accepts permissions without data scope metadata', () => {
    expect(() =>
      assertUnscopedPermissionAvailable(registry(), {
        permission: 'sample.manage',
        capability: 'sample.core',
        scope: 'UNSCOPED',
      }),
    ).not.toThrow()
  })

  it('reports an explicit programming error for scoped permissions', () => {
    const error = (() => {
      try {
        assertUnscopedPermissionAvailable(registry(), {
          permission: 'sample.view',
          capability: 'sample.core',
          scope: 'UNSCOPED',
        })
        return null
      } catch (cause) {
        return cause
      }
    })()

    expect(error).toBeInstanceOf(ApplicationError)
    expect(error).toMatchObject({
      code: 'AUTHZ_SCOPE_PERMISSION_REQUIRES_EVALUATOR',
      status: 500,
    })
  })
})
