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
  routeDefinitions: [],
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
})
