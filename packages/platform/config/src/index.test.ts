import { expect, it } from 'vitest'

import { loadConfig } from './index.js'

it('validates and normalizes the anonymous bootstrap tenant without accepting an empty code', () => {
  expect(loadConfig({}).bootstrapTenantCode).toBe('default')
  expect(loadConfig({ BOOTSTRAP_TENANT_CODE: ' tenant-a ' }).bootstrapTenantCode).toBe('tenant-a')
  expect(() => loadConfig({ BOOTSTRAP_TENANT_CODE: ' ' })).toThrow()
})

it('derives cookie security from the external origin and requires explicit proxy trust', () => {
  expect(loadConfig({}).http).toEqual({
    host: '127.0.0.1',
    port: 3000,
    trustProxy: false,
    secureCookies: false,
  })
  expect(loadConfig({ APP_ORIGIN: 'https://jingwei.example.com' }).http.secureCookies).toBe(true)
  expect(loadConfig({ HTTP_TRUST_PROXY: 'true' }).http.trustProxy).toBe(true)
  expect(() =>
    loadConfig({ APP_ORIGIN: 'https://jingwei.example.com', COOKIE_SECURE: 'false' }),
  ).toThrow('COOKIE_SECURE must be true')
})

it('builds a bounded access and refresh token policy', () => {
  expect(loadConfig({}).session).toEqual({
    accessSeconds: 600,
    refreshIdleSeconds: 1_800,
    refreshAbsoluteSeconds: 604_800,
    refreshReuseGraceSeconds: 5,
  })
  expect(() =>
    loadConfig({
      AUTH_ACCESS_TOKEN_SECONDS: '700',
      AUTH_REFRESH_ABSOLUTE_SECONDS: '600',
    }),
  ).toThrow('AUTH_ACCESS_TOKEN_SECONDS must be lower')
  expect(() =>
    loadConfig({
      AUTH_ACCESS_TOKEN_SECONDS: '300',
      AUTH_REFRESH_IDLE_SECONDS: '600',
      AUTH_REFRESH_ABSOLUTE_SECONDS: '600',
    }),
  ).toThrow('AUTH_REFRESH_IDLE_SECONDS must be lower')
  expect(() =>
    loadConfig({
      AUTH_ACCESS_TOKEN_SECONDS: '1800',
      AUTH_REFRESH_IDLE_SECONDS: '1800',
      AUTH_REFRESH_ABSOLUTE_SECONDS: '3600',
    }),
  ).toThrow('AUTH_ACCESS_TOKEN_SECONDS must be lower than AUTH_REFRESH_IDLE_SECONDS')
})

it('builds a bounded login lockout policy', () => {
  expect(loadConfig({}).login).toEqual({
    maxFailedAttempts: 5,
    lockSeconds: 900,
  })
  expect(() => loadConfig({ AUTH_LOGIN_MAX_FAILED_ATTEMPTS: '2' })).toThrow()
  expect(() => loadConfig({ AUTH_LOGIN_LOCK_SECONDS: '30' })).toThrow()
})
