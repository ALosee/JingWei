import { describe, expect, it } from 'vitest'

import { defineEdition, resolveEdition } from './edition.js'
import { defineModule } from './manifest.js'

const base = defineModule({
  id: 'base',
  name: 'Base',
  category: 'foundation',
  dependencies: [],
  optionalDependencies: [],
  capabilities: [],
  permissions: [],
  routeDefinitions: [
    {
      key: 'base.login',
      page: 'BaseLogin',
      layout: 'blank',
      allowedAccessModes: ['PUBLIC'],
    },
  ],
  navigationItems: [
    {
      code: 'base.login',
      name: 'Login',
      type: 'PAGE',
      parentCode: null,
      routeKey: 'base.login',
      path: '/login',
      accessMode: 'PUBLIC',
    },
  ],
})

const feature = defineModule({
  id: 'feature',
  name: 'Feature',
  category: 'business',
  dependencies: ['base'],
  optionalDependencies: [],
  capabilities: [{ id: 'feature.core', name: 'Core' }],
  permissions: [{ code: 'feature.view', name: 'View' }],
  routeDefinitions: [
    {
      key: 'feature.list',
      page: 'FeatureList',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'feature.core',
      requiredPermission: 'feature.view',
    },
  ],
  navigationItems: [
    {
      code: 'feature.list',
      name: 'Feature',
      type: 'MENU',
      parentCode: 'workspace',
      routeKey: 'feature.list',
      path: '/feature',
      accessMode: 'PERMISSION',
    },
  ],
})

describe('resolveEdition', () => {
  it('requires the default layout to remain inside the allowed layout set', () => {
    expect(() =>
      defineModule({
        ...feature,
        routeDefinitions: feature.routeDefinitions.map((route) => ({
          ...route,
          allowedLayouts: ['blank'] as const,
        })),
      }),
    ).toThrow('default layout must be allowed')
    expect(() =>
      defineModule({
        ...feature,
        routeDefinitions: feature.routeDefinitions.map((route) => ({
          ...route,
          allowedLayouts: ['base', 'blank'] as const,
        })),
      }),
    ).not.toThrow()
  })
  it('adds required modules and orders dependencies first', () => {
    const resolved = resolveEdition(defineEdition({ id: 'test', modules: { feature: true } }), [
      feature,
      base,
    ])

    expect(resolved.modules.map(({ manifest }) => manifest.id)).toEqual(['base', 'feature'])
  })

  it('rejects missing modules', () => {
    expect(() =>
      resolveEdition(defineEdition({ id: 'test', modules: { missing: true } }), [base]),
    ).toThrow('Unknown module: missing')
  })

  it('rejects provider-backed permissions when the provider module is not selected', () => {
    const consumer = defineModule({
      id: 'consumer',
      name: 'Consumer',
      category: 'business',
      dependencies: ['base'],
      optionalDependencies: ['organization'],
      capabilities: [],
      permissions: [
        {
          code: 'consumer.view',
          name: 'View',
          dataScope: {
            allowedTypes: ['ALL', 'CUSTOM'],
            provider: 'organization',
          },
        },
      ],
      routeDefinitions: [],
    })
    expect(() =>
      resolveEdition(defineEdition({ id: 'test', modules: { consumer: true } }), [consumer, base]),
    ).toThrow('requires missing data-scope provider organization')
  })

  it('filters default navigation items whose capability is disabled', () => {
    const resolved = resolveEdition(
      defineEdition({
        id: 'test',
        modules: { feature: { capabilities: [] } },
        navigation: {
          authEntryCode: 'base.login',
          homeCode: null,
          containers: [{ code: 'workspace', name: 'Workspace', type: 'GROUP', parentCode: null }],
        },
      }),
      [feature, base],
    )
    expect(resolved.navigation?.items.map(({ code }) => code)).toEqual(['base.login'])
  })
})
