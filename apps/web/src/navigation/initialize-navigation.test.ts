import { describe, expect, it, vi } from 'vitest'
import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'
import { initializeNavigation, type NavigationStartupDependencies } from './initialize-navigation.js'
import { selectInitialLocation } from './initial-location.js'

const login: NavigationNode = {
  id: 'login', code: 'signin', name: '登录', type: 'PAGE', parentId: null, status: 'ENABLED',
  routeKey: 'iam.login', path: '/signin', layout: 'blank', accessMode: 'PUBLIC', icon: null,
  sortOrder: 0, href: null, externalTarget: null, params: {}, query: {},
}
const home: NavigationNode = {
  ...login, id: 'home', code: 'account', type: 'MENU',
  routeKey: 'iam.account', path: '/account/:id', layout: 'base', accessMode: 'AUTHENTICATED',
  params: { id: 'me' }, query: { tab: 'profile' }
}
const bootstrap: NavigationResponse = {
  schemaVersion: 2, versionId: 'v1', publishedRevision: 1,
  authEntryCode: login.code, homeCode: null, nodes: [login]
}
const authenticated: NavigationResponse = { ...bootstrap, homeCode: home.code, nodes: [login, home] }

function dependencies(loggedIn: boolean) {
  const events: string[] = []
  const ports: NavigationStartupDependencies = {
    loadBootstrap: vi.fn(() => { events.push('bootstrap'); return Promise.resolve(bootstrap) }),
    loadSession: vi.fn(() => { events.push('session'); return Promise.resolve({ authenticated: loggedIn }) }),
    loadAuthenticated: vi.fn(() => { events.push('me'); return Promise.resolve(authenticated) }),
    install: vi.fn((value: NavigationResponse) => { events.push(value === bootstrap ? 'install-public' : 'install-user') }),
    recognizes: () => false,
    replace: vi.fn((value: string) => { events.push('replace:' + value); return Promise.resolve() }),
    shell: { navigation: null, bootstrapError: null },
  }
  return { ports, events }
}
describe('navigation startup orchestration', () => {
  it('loads public navigation before session status and never requests me for an anonymous user', async () => {
    const { ports, events } = dependencies(false)
    await initializeNavigation('/', ports)
    expect(events).toEqual(['bootstrap', 'install-public', 'session', 'install-public', 'replace:/signin'])
    expect(ports.loadAuthenticated).not.toHaveBeenCalled()
    expect(ports.shell.navigation).toBe(bootstrap)
  })
  it('replaces the complete public projection after authenticated navigation loads', async () => {
    const { ports, events } = dependencies(true)
    await initializeNavigation('/', ports)
    expect(events).toEqual(['bootstrap', 'install-public', 'session', 'me', 'install-user', 'replace:/account/me?tab=profile'])
    expect(ports.shell.navigation).toBe(authenticated)
  })
  it('falls back to public navigation when the session expires between requests', async () => {
    const { ports } = dependencies(true)
    ports.loadAuthenticated = () => Promise.resolve(null)
    await initializeNavigation('/', ports)
    expect(ports.replace).toHaveBeenCalledWith('/signin')
    expect(ports.shell.navigation).toBe(bootstrap)
  })
  it('routes bootstrap errors to static recovery without issuing later requests', async () => {
    const { ports } = dependencies(true)
    ports.loadBootstrap = () => Promise.reject(new Error('unavailable'))
    await initializeNavigation('/', ports)
    expect(ports.loadSession).not.toHaveBeenCalled()
    expect(ports.shell.bootstrapError).toBe('unavailable')
    expect(ports.replace).toHaveBeenCalledWith('/__recovery')
  })
})
describe('initial location policy', () => {
  it.each([
    ['/account/123?tab=security#keys', true, true, '/account/123?tab=security#keys'],
    ['/signin', false, true, '/signin'],
    ['/missing', true, false, '/__recovery'],
    ['/missing', false, false, '/signin'],
    ['/', true, true, '/account/me?tab=profile'],
  ])('resolves %s (authenticated=%s, recognized=%s)', (initialLocation, loggedIn, recognized, expected) => {
    expect(selectInitialLocation({ initialLocation, navigation: authenticated, authenticated: loggedIn, recognized })).toBe(expected)
  })
  it('uses static recovery when no visible home can be resolved', () => {
    expect(selectInitialLocation({ initialLocation: '/', navigation: bootstrap, authenticated: true, recognized: false })).toBe('/__recovery')
  })
})
