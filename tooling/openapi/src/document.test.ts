import { describe, expect, it } from 'vitest'

import { controlPlaneOpenApiContract } from '@jingwei/control-plane/openapi'
import { iamOpenApiContract } from '@jingwei/module-iam/openapi'
import { navigationOpenApiContract } from '@jingwei/module-navigation/openapi'

import { createModuleOpenApiDocument } from './document.js'

describe('module OpenAPI documents', () => {
  it('prefixes IAM operations with the public API version', () => {
    const document = createModuleOpenApiDocument(iamOpenApiContract)

    expect(Object.keys(document.paths ?? {})).toEqual([
      '/api/v1/iam/sessions',
      '/api/v1/iam/session',
      '/api/v1/iam/sessions/refresh',
      '/api/v1/iam/sessions/current',
      '/api/v1/iam/account',
      '/api/v1/iam/account/password',
      '/api/v1/iam/account/roles',
      '/api/v1/iam/roles',
      '/api/v1/iam/roles/{roleId}',
      '/api/v1/iam/permissions',
      '/api/v1/iam/roles/{roleId}/permissions',
      '/api/v1/iam/users',
      '/api/v1/iam/users/{userId}',
      '/api/v1/iam/users/{userId}/password',
      '/api/v1/iam/users/{userId}/roles',
    ])
    expect(document.paths?.['/api/v1/iam/sessions']?.post?.operationId).toBe('iamCreateSession')
  })

  it('documents session and CSRF requirements for navigation mutations', () => {
    const document = createModuleOpenApiDocument(navigationOpenApiContract)
    const publish = document.paths?.['/api/v1/navigation/versions/{id}/publish']?.post

    expect(publish?.security).toEqual([{ accessTokenCookie: [], csrfHeader: [] }])
    expect(document.components?.securitySchemes).toMatchObject({
      accessTokenCookie: { type: 'apiKey', in: 'cookie', name: 'jingwei_access' },
      csrfHeader: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
      refreshTokenCookie: { type: 'apiKey', in: 'cookie', name: 'jingwei_refresh' },
    })
  })

  it('documents independent platform cookie and CSRF credentials', () => {
    const document = createModuleOpenApiDocument(controlPlaneOpenApiContract)
    const tenants = document.paths?.['/api/v1/platform/tenants']?.post

    expect(tenants?.security).toEqual([{ platformAccessTokenCookie: [], platformCsrfHeader: [] }])
    expect(document.components?.securitySchemes).toMatchObject({
      platformAccessTokenCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'jingwei_platform_access',
      },
      platformRefreshTokenCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'jingwei_platform_refresh',
      },
      platformCsrfHeader: { type: 'apiKey', in: 'header', name: 'x-platform-csrf-token' },
    })
  })
})
