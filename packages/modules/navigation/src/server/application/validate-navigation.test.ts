import { describe, expect, it } from 'vitest'

import { newEntityId } from '@jingwei/kernel'
import { manifest as iamManifest } from '@jingwei/module-iam/manifest'
import { defineEdition, ModuleRegistry, resolveEdition } from '@jingwei/module-sdk'

import { manifest as navigationManifest } from '../../manifest.js'
import { navigationTarget, type NavigationNode } from '../../shared/index.js'
import { createDefaultConfiguration } from './default-configuration.js'
import { projectNodes } from './resolve-navigation.js'
import { validateNavigation } from './validate-navigation.js'

const registry = new ModuleRegistry(
  resolveEdition(defineEdition({ id: 'test', modules: { iam: true, navigation: true } }), [
    iamManifest,
    navigationManifest,
  ]),
)
function fixture() {
  return createDefaultConfiguration(registry)
}
function find(nodes: NavigationNode[], code: string) {
  const node = nodes.find((item) => item.code === code)
  if (node === undefined) throw new Error('Missing fixture ' + code)
  return node
}
describe('unified navigation validation', () => {
  it('accepts a valid configuration and keeps PAGE out of menu semantics', () => {
    expect(validateNavigation(fixture(), registry)).toEqual([])
  })
  it('rejects public downgrade, unsupported layout, duplicate route keys and unsafe links', () => {
    const config = fixture()
    const manage = find(config.nodes, 'navigation.manage')
    manage.accessMode = 'PUBLIC'
    manage.layout = 'blank'
    config.nodes.push({ ...manage, id: newEntityId(), code: 'duplicate' })
    config.nodes.push({
      ...manage,
      id: newEntityId(),
      code: 'external',
      type: 'EXTERNAL_LINK',
      routeKey: null,
      path: null,
      layout: null,
      href: 'javascript:alert(1)',
      externalTarget: 'BLANK',
    })
    const codes = validateNavigation(config, registry).map((issue) => issue.code)
    expect(codes).toEqual(
      expect.arrayContaining([
        'NAVIGATION_ACCESS_MODE_FORBIDDEN',
        'NAVIGATION_LAYOUT_FORBIDDEN',
        'NAVIGATION_ROUTE_DUPLICATE',
        'NAVIGATION_EXTERNAL_URL_INVALID',
      ]),
    )
  })
  it('rejects cycles, invalid parents, query-in-path and unresolved menu params', () => {
    const config = fixture()
    const manage = find(config.nodes, 'navigation.manage')
    manage.path = '/navigation/:id'
    const account = find(config.nodes, 'iam.account')
    account.parentId = account.id
    account.path = '/account?tab=a'
    expect(validateNavigation(config, registry).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'NAVIGATION_CYCLE',
        'NAVIGATION_PATH_INVALID',
        'NAVIGATION_PARAMS_REQUIRED',
      ]),
    )
  })
  it('accepts hidden dynamic pages and encodes default params/query separately', () => {
    const config = fixture()
    const manage = find(config.nodes, 'navigation.manage')
    manage.type = 'PAGE'
    manage.path = '/navigation/:id'
    expect(validateNavigation(config, registry)).toEqual([])
    expect(navigationTarget(manage)).toBeNull()
    manage.params = { id: 'a/b' }
    manage.query = { tab: 'members', tags: ['x', 'y'] }
    expect(navigationTarget(manage)).toBe('/navigation/a%2Fb?tab=members&tags=x&tags=y')
  })
  it('rejects dot-segment default params and overlapping path templates', () => {
    const config = fixture()
    const manage = find(config.nodes, 'navigation.manage')
    manage.type = 'PAGE'
    manage.path = '/account/:id?'
    manage.params = { id: '..' }
    expect(navigationTarget(manage)).toBeNull()
    expect(validateNavigation(config, registry).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['NAVIGATION_PARAM_INVALID', 'NAVIGATION_PATH_COLLISION']),
    )
  })
})
describe('navigation-code RBAC projection', () => {
  it('preserves public ancestors and hides ungranted external links without a routeKey', () => {
    const config = fixture()
    const account = find(config.nodes, 'iam.account')
    const external: NavigationNode = {
      ...account,
      id: newEntityId(),
      code: 'external.help',
      type: 'EXTERNAL_LINK',
      routeKey: null,
      path: null,
      layout: null,
      href: 'https://example.com',
      externalTarget: 'BLANK',
      accessMode: 'PERMISSION',
    }
    config.nodes.push(external)
    expect(projectNodes(config.nodes, false, new Set()).map((node) => node.code)).toEqual([
      'iam.login',
    ])
    const permitted = projectNodes(config.nodes, true, new Set(['external.help']))
    expect(permitted.map((node) => node.code)).toContain('external.help')
    expect(permitted.map((node) => node.code)).not.toContain('navigation.manage')
    expect(permitted.map((node) => node.code)).not.toContain('administration')
  })
  it('prunes disabled branches and retains granted PAGE independently of parent permission', () => {
    const config = fixture()
    const manage = find(config.nodes, 'navigation.manage')
    manage.type = 'PAGE'
    manage.parentId = find(config.nodes, 'iam.account').id
    expect(
      projectNodes(config.nodes, true, new Set(['navigation.manage'])).map((node) => node.code),
    ).toContain('navigation.manage')
    find(config.nodes, 'workspace').status = 'DISABLED'
    expect(
      projectNodes(config.nodes, true, new Set(['navigation.manage'])).map((node) => node.code),
    ).toEqual(['iam.login'])
  })
})
