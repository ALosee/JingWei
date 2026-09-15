import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'

import { useShellStore } from '../stores/shell.js'
import { installSessionExpiryRedirect } from './use-session-expiry.js'

const listeners = new Set<() => void>()

vi.mock('@jingwei/api-client', () => ({
  subscribeSessionExpired(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}))

vi.mock('@jingwei/module-iam/web', () => ({
  setIamSessionUser: vi.fn(),
}))

function loginNode(): NavigationNode {
  return {
    id: 'login',
    code: 'iam.login',
    name: '登录',
    parentId: null,
    type: 'PAGE',
    status: 'ENABLED',
    routeKey: 'iam.login',
    path: '/signin',
    layout: 'blank',
    icon: null,
    sortOrder: 0,
    accessMode: 'PUBLIC',
    href: null,
    externalTarget: null,
    params: {},
    query: {},
  }
}

describe('session expiry redirect', () => {
  it('leaves for auth entry with a safe redirect query', () => {
    setActivePinia(createPinia())
    listeners.clear()
    const shell = useShellStore()
    const navigation: NavigationResponse = {
      schemaVersion: 2,
      versionId: 'v',
      publishedRevision: 1,
      authEntryCode: 'iam.login',
      homeCode: null,
      nodes: [loginNode()],
    }
    shell.navigation = navigation
    shell.currentUser = null
    const leave = vi.fn()
    const dispose = installSessionExpiryRedirect(leave, () => '/account?tab=roles')
    for (const listener of listeners) listener()
    expect(leave).toHaveBeenCalledWith(
      '/signin?redirect=' + encodeURIComponent('/account?tab=roles'),
    )
    expect(shell.navigation).toBeNull()
    dispose()
  })
})
