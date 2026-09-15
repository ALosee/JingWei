import { describe, expect, it } from 'vitest'

import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'

import {
  resolveAuthEntryTarget,
  resolveHomeTarget,
  resolveSafeReturnPath,
  withRedirectQuery,
} from './workspace-targets.js'

function node(partial: Partial<NavigationNode> & { id: string; code: string }): NavigationNode {
  return {
    name: partial.code,
    parentId: null,
    type: 'MENU',
    status: 'ENABLED',
    routeKey: 'demo.page',
    path: '/demo',
    layout: 'base',
    icon: null,
    sortOrder: 0,
    accessMode: 'AUTHENTICATED',
    href: null,
    externalTarget: null,
    params: {},
    query: {},
    ...partial,
  }
}

function response(
  partial: Partial<NavigationResponse> & Pick<NavigationResponse, 'nodes'>,
): NavigationResponse {
  return {
    schemaVersion: 2,
    versionId: 'version',
    publishedRevision: 1,
    authEntryCode: 'iam.login',
    homeCode: null,
    ...partial,
  }
}

describe('workspace targets', () => {
  it('resolves home from homeCode then first non-public menu', () => {
    const nodes = [
      node({ id: 'login', code: 'iam.login', type: 'PAGE', accessMode: 'PUBLIC', path: '/signin' }),
      node({ id: 'account', code: 'iam.account', path: '/account' }),
    ]
    expect(resolveHomeTarget(response({ nodes, homeCode: 'iam.account' }))).toBe('/account')
    expect(resolveHomeTarget(response({ nodes, homeCode: null }))).toBe('/account')
    expect(resolveHomeTarget(null)).toBe('/')
  })

  it('resolves auth entry and blocks unsafe return paths', () => {
    const nodes = [
      node({ id: 'login', code: 'iam.login', type: 'PAGE', accessMode: 'PUBLIC', path: '/signin' }),
    ]
    const navigation = response({ nodes })
    expect(resolveAuthEntryTarget(navigation)).toBe('/signin')
    expect(resolveSafeReturnPath('/account?tab=roles')).toBe('/account?tab=roles')
    expect(resolveSafeReturnPath('//evil.example')).toBe('/')
    expect(resolveSafeReturnPath('https://evil.example')).toBe('/')
    expect(resolveSafeReturnPath('/__recovery')).toBe('/')
    expect(withRedirectQuery('/signin', '/account')).toBe(
      '/signin?redirect=' + encodeURIComponent('/account'),
    )
  })
})
