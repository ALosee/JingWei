import { describe, expect, it, vi } from 'vitest'

import {
  accessTokenCookieName,
  csrfCookieName,
  refreshTokenCookieName,
  refreshTokenCookiePath,
  type CreatedSession,
} from '@jingwei/auth'
import { newSessionId, newTenantId, newUserId } from '@jingwei/kernel'

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
            },
          }),
        ),
      },
      sessions: {
        logout: vi.fn(),
        refresh: vi.fn(),
      },
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
