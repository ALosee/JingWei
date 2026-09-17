import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { apiErrorSchema } from '@jingwei/http-contract'

import { createApp } from './app.js'
import { createRuntime } from './bootstrap/runtime.js'

const documentSchema = z.object({
  openapi: z.literal('3.1.0'),
  paths: z.record(z.string(), z.unknown()),
  components: z.object({
    securitySchemes: z.record(z.string(), z.unknown()),
  }),
})
const permissionRequirementSchema = z
  .object({
    permission: z.string(),
    capability: z.string(),
    scope: z.enum(['UNSCOPED', 'SCOPED']),
  })
  .strict()
const authorizationContractSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PUBLIC') }).strict(),
  z.object({ kind: z.literal('AUTHENTICATED') }).strict(),
  z.object({ kind: z.literal('REFRESH_TOKEN') }).strict(),
  z
    .object({
      kind: z.literal('PERMISSION'),
      requirements: z.array(permissionRequirementSchema).nonempty(),
    })
    .strict(),
])
const operationSchema = z.object({
  operationId: z.string(),
  'x-jingwei-authorization': authorizationContractSchema,
})
const httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

function operationContract(
  paths: Readonly<Record<string, unknown>>,
  path: string,
  method: (typeof httpMethods)[number],
) {
  const item = z.record(z.string(), z.unknown()).parse(paths[path])
  return operationSchema.parse(item[method])['x-jingwei-authorization']
}

describe('API documentation', () => {
  it('serves the mounted module contract as OpenAPI 3.1 and renders Scalar', async () => {
    const runtime = createRuntime({ NODE_ENV: 'test' })
    try {
      const app = await createApp(runtime)
      const documentResponse = await app.request('/openapi/v1.json')
      const document = documentSchema.parse(await documentResponse.json())

      expect(documentResponse.status).toBe(200)
      expect(document.paths).toHaveProperty('/api/v1/iam/sessions')
      expect(document.paths).toHaveProperty('/api/v1/navigation/versions/{id}/publish')
      expect(document.components.securitySchemes).toHaveProperty('accessTokenCookie')
      expect(document.components.securitySchemes).toHaveProperty('refreshTokenCookie')
      expect(document.components.securitySchemes).toHaveProperty('csrfHeader')
      let operationCount = 0
      for (const [path, value] of Object.entries(document.paths)) {
        if (!path.startsWith('/api/v1/')) continue
        const item = z.record(z.string(), z.unknown()).parse(value)
        for (const method of httpMethods) {
          if (item[method] === undefined) continue
          operationSchema.parse(item[method])
          operationCount += 1
        }
      }
      expect(operationCount).toBe(61)

      expect(operationContract(document.paths, '/api/v1/iam/sessions', 'post')).toEqual({
        kind: 'PUBLIC',
      })
      expect(operationContract(document.paths, '/api/v1/iam/account', 'get')).toEqual({
        kind: 'AUTHENTICATED',
      })
      expect(operationContract(document.paths, '/api/v1/iam/sessions/refresh', 'post')).toEqual({
        kind: 'REFRESH_TOKEN',
      })
      expect(operationContract(document.paths, '/api/v1/navigation/admin', 'get')).toEqual({
        kind: 'PERMISSION',
        requirements: [
          {
            permission: 'navigation.view',
            capability: 'navigation.core',
            scope: 'UNSCOPED',
          },
        ],
      })
      expect(operationContract(document.paths, '/api/v1/organization/org-units', 'get')).toEqual({
        kind: 'PERMISSION',
        requirements: [
          {
            permission: 'organization.view',
            capability: 'organization.core',
            scope: 'SCOPED',
          },
        ],
      })
      expect(
        operationContract(document.paths, '/api/v1/navigation/roles/{roleId}/grants', 'put'),
      ).toEqual({
        kind: 'PERMISSION',
        requirements: [
          {
            permission: 'navigation.manage',
            capability: 'navigation.core',
            scope: 'UNSCOPED',
          },
          {
            permission: 'iam.role.manage',
            capability: 'iam.authorization',
            scope: 'UNSCOPED',
          },
        ],
      })

      const scalarResponse = await app.request('/docs')
      const html = await scalarResponse.text()
      expect(scalarResponse.status).toBe(200)
      expect(html).toContain('Jingwei API Reference')
      expect(html).toContain('/openapi/v1.json')

      const invalidContentType = await app.request('/api/v1/iam/sessions', {
        method: 'POST',
        headers: { origin: 'http://localhost:5173' },
        body: '{}',
      })
      expect(invalidContentType.status).toBe(415)
      const invalidContentTypeError = apiErrorSchema.parse(await invalidContentType.json())
      expect(invalidContentTypeError.code).toBe('UNSUPPORTED_MEDIA_TYPE')
      expect(invalidContentTypeError.requestId.length).toBeGreaterThan(0)
    } finally {
      await runtime.dispose()
    }
  })
})
