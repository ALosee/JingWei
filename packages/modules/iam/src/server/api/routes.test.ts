import { describe, expect, it, vi } from 'vitest'

import {
  accessTokenCookieName,
  csrfCookieName,
  refreshTokenCookieName,
  refreshTokenCookiePath,
  type CreatedSession,
} from '@jingwei/auth'
import { newRequestId, newSessionId, newTenantId, newUserId } from '@jingwei/kernel'
import { createApiRouter } from '@jingwei/module-sdk/server'

import { createIamRoutes } from './routes.js'

const accessExpiresAt = new Date('2026-09-10T10:10:00.000Z')
const absoluteExpiresAt = new Date('2026-09-17T10:00:00.000Z')

function session(overrides: Partial<CreatedSession> = {}): CreatedSession {
  return {
    id: newSessionId(),
    tenantId: newTenantId(),
    userId: newUserId(),
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
    csrfToken: 'csrf-secret',
    csrfTokenHash: 'csrf-hash',
    accessExpiresAt,
    absoluteExpiresAt,
    ...overrides,
  }
}

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
}

describe('IAM session HTTP boundary', () => {
  it('returns the mutable safe user projection for an authenticated session', async () => {
    const current = session()
    const readCurrentUser = vi.fn(() =>
      Promise.resolve({
        id: current.userId,
        tenantId: current.tenantId,
        displayName: 'Admin',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    )
    const routes = createIamRoutes({
      authenticateUser: { execute: vi.fn() },
      readCurrentUser: { execute: readCurrentUser },
      sessions: { logout: vi.fn(), refresh: vi.fn() },
      secureCookies: false,
      logger,
    })
    const app = createApiRouter()
    app.use('*', async (context, next) => {
      context.set('requestId', newRequestId())
      context.set('authContext', {
        requestId: newRequestId(),
        sessionId: current.id,
        tenantId: current.tenantId,
        userId: current.userId,
        roleIds: [],
      })
      await next()
    })
    app.route('/', routes)

    const response = await app.request('/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      authenticated: true,
      user: {
        id: current.userId,
        tenantId: current.tenantId,
        displayName: 'Admin',
        avatarUrl: 'https://example.com/avatar.png',
      },
    })
    expect(readCurrentUser).toHaveBeenCalledWith(current.tenantId, current.userId)
  })

  it('sets separate hardened access, refresh, and CSRF cookies without returning credentials', async () => {
    const created = session()
    const routes = createIamRoutes({
      authenticateUser: {
        execute: vi.fn(() =>
          Promise.resolve({
            session: created,
            user: {
              id: created.userId,
              tenantId: created.tenantId,
              displayName: 'Admin',
              avatarUrl: null,
            },
          }),
        ),
      },
      sessions: {
        logout: vi.fn(),
        refresh: vi.fn(),
      },
      readCurrentUser: { execute: vi.fn() },
      secureCookies: true,
      logger,
    })

    const response = await routes.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantCode: 'default',
        login: 'admin',
        password: 'correct-password',
      }),
    })

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body: unknown = await response.json()
    expect(body).toEqual({
      user: {
        id: created.userId,
        tenantId: created.tenantId,
        displayName: 'Admin',
        avatarUrl: null,
      },
      session: {
        accessExpiresAt: accessExpiresAt.toISOString(),
        absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      },
    })
    const cookies = response.headers.getSetCookie()
    expectCookie(cookies, accessTokenCookieName, [
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
    ])
    expectCookie(cookies, refreshTokenCookieName, [
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      `Path=${refreshTokenCookiePath}`,
    ])
    const csrfCookie = expectCookie(cookies, csrfCookieName, [
      'Secure',
      'SameSite=Strict',
      'Path=/',
    ])
    expect(csrfCookie).not.toContain('HttpOnly')
    expect(JSON.stringify(body)).not.toContain('access-secret')
  })

  it('rotates only the HttpOnly credentials and keeps the existing CSRF cookie', async () => {
    const rotated = session({ accessToken: 'next-access', refreshToken: 'next-refresh' })
    const refresh = vi.fn(() => Promise.resolve({ status: 'refreshed' as const, session: rotated }))
    const routes = createIamRoutes({
      authenticateUser: { execute: vi.fn() },
      sessions: { logout: vi.fn(), refresh },
      readCurrentUser: { execute: vi.fn() },
      secureCookies: false,
      logger,
    })

    const response = await routes.request('/sessions/refresh', {
      method: 'POST',
      headers: {
        cookie: `${refreshTokenCookieName}=old-refresh; ${csrfCookieName}=csrf-secret`,
        'x-csrf-token': 'csrf-secret',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(refresh).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'old-refresh',
        csrfCookieToken: 'csrf-secret',
        csrfHeaderToken: 'csrf-secret',
      }),
    )
    const cookies = response.headers.getSetCookie()
    expectCookie(cookies, accessTokenCookieName, ['HttpOnly', 'SameSite=Strict', 'Path=/'])
    expectCookie(cookies, refreshTokenCookieName, [
      'HttpOnly',
      'SameSite=Strict',
      `Path=${refreshTokenCookiePath}`,
    ])
    expect(cookies.some((value) => value.startsWith(`${csrfCookieName}=`))).toBe(false)
  })
})

function expectCookie(cookies: string[], name: string, attributes: string[]): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`))
  expect(cookie, `Missing ${name}`).toBeDefined()
  for (const attribute of attributes) expect(cookie).toContain(attribute)
  return cookie ?? ''
}
