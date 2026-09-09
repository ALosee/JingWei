import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { ServerAppEnv } from '@jingwei/module-sdk/server'

export function createSystemRoutes(editionId: string) {
  const app = new OpenAPIHono<ServerAppEnv>()
  app.openapi(
    createRoute({
      method: 'get',
      path: '/health',
      operationId: 'systemGetHealth',
      tags: ['System'],
      summary: '检查服务存活状态',
      responses: {
        200: {
          description: '服务已启动',
          content: {
            'application/json': {
              schema: z.object({ status: z.literal('ok'), edition: z.string() }),
            },
          },
        },
      },
    }),
    (context) => context.json({ status: 'ok' as const, edition: editionId }, 200),
  )
  return app
}
