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
      expect(document.components.securitySchemes).toHaveProperty('sessionCookie')
      expect(document.components.securitySchemes).toHaveProperty('csrfHeader')

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
