import { describe, expect, it } from 'vitest'

import {
  apiAuthorizationExtension,
  assertApiAuthorizationContracts,
  authenticatedApiAccess,
  createApiRoute,
  permissionApiAccess,
  publicApiAccess,
} from './api-authorization.js'
import { definePermissionRequirement } from './authorization.js'
import { defineModule } from './manifest.js'
import { ModuleRegistry } from './registry.js'

const registry = new ModuleRegistry({
  id: 'test',
  modules: [
    {
      manifest: defineModule({
        id: 'sample',
        name: 'Sample',
        category: 'foundation',
        dependencies: [],
        optionalDependencies: [],
        capabilities: [{ id: 'sample.core', name: 'Sample' }],
        permissions: [
          { code: 'sample.manage', name: 'Manage' },
          {
            code: 'sample.view',
            name: 'View',
            dataScope: { allowedTypes: ['ALL', 'SELF'] },
          },
        ],
        routeDefinitions: [],
      }),
      enabledCapabilities: new Set(['sample.core']),
    },
  ],
})

const response = { 204: { description: 'Done' } }
const security = [{ accessTokenCookie: [] }]

describe('API authorization contracts', () => {
  it('reuses an immutable owner-defined requirement in the API contract', () => {
    const requirement = definePermissionRequirement({
      permission: 'sample.manage',
      capability: 'sample.core',
      scope: 'UNSCOPED',
    })
    const contract = permissionApiAccess(requirement)
    expect(Object.isFrozen(requirement)).toBe(true)
    expect(contract.requirements[0]).toBe(requirement)
  })

  it('embeds the contract in OpenAPI route metadata', () => {
    const route = createApiRoute(publicApiAccess, {
      method: 'get',
      path: '/sample',
      operationId: 'samplePublic',
      responses: response,
    })
    expect(route[apiAuthorizationExtension]).toEqual({ kind: 'PUBLIC' })
  })

  it('rejects security declarations that contradict the access kind', () => {
    expect(() =>
      createApiRoute(publicApiAccess, {
        method: 'get',
        path: '/public',
        security,
        responses: response,
      }),
    ).toThrow('must not declare security')
    expect(() =>
      createApiRoute(authenticatedApiAccess, {
        method: 'get',
        path: '/private',
        responses: response,
      }),
    ).toThrow('must declare OpenAPI security')
  })

  it('validates enabled permissions, capabilities and scope modes', () => {
    const valid = {
      type: 'route',
      route: createApiRoute(
        permissionApiAccess({
          permission: 'sample.view',
          capability: 'sample.core',
          scope: 'SCOPED',
        }),
        {
          method: 'get',
          path: '/api/v1/sample/items',
          operationId: 'sampleListItems',
          security,
          responses: response,
        },
      ),
    }
    expect(() => assertApiAuthorizationContracts([valid], registry)).not.toThrow()

    const invalid = {
      ...valid,
      route: {
        ...valid.route,
        [apiAuthorizationExtension]: permissionApiAccess({
          permission: 'sample.view',
          capability: 'sample.core',
          scope: 'UNSCOPED',
        }),
      },
    }
    expect(() => assertApiAuthorizationContracts([invalid], registry)).toThrow('接口授权契约无效')
  })

  it('rejects enabled API routes without authorization metadata', () => {
    expect(() =>
      assertApiAuthorizationContracts(
        [
          {
            type: 'route',
            route: { path: '/api/v1/sample/items', operationId: 'sampleMissingContract' },
          },
        ],
        registry,
      ),
    ).toThrow('接口授权契约无效')
  })
})
