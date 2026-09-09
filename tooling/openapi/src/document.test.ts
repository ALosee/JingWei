import { describe, expect, it } from 'vitest'

import { iamOpenApiContract } from '@jingwei/module-iam/openapi'
import { navigationOpenApiContract } from '@jingwei/module-navigation/openapi'

import { createModuleOpenApiDocument } from './document.js'

describe('module OpenAPI documents', () => {
  it('prefixes IAM operations with the public API version', () => {
    const document = createModuleOpenApiDocument(iamOpenApiContract)

    expect(Object.keys(document.paths ?? {})).toEqual([
      '/api/v1/iam/sessions',
      '/api/v1/iam/session',
      '/api/v1/iam/sessions/current',
    ])
    expect(document.paths?.['/api/v1/iam/sessions']?.post?.operationId).toBe('iamCreateSession')
  })

  it('documents session and CSRF requirements for navigation mutations', () => {
    const document = createModuleOpenApiDocument(navigationOpenApiContract)
    const publish = document.paths?.['/api/v1/navigation/versions/{id}/publish']?.post

    expect(publish?.security).toEqual([{ sessionCookie: [], csrfHeader: [] }])
    expect(document.components?.securitySchemes).toMatchObject({
      sessionCookie: { type: 'apiKey', in: 'cookie', name: 'jingwei_session' },
      csrfHeader: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
    })
  })
})
