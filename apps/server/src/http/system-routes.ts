import { Hono } from 'hono'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

export function createSystemRoutes(editionId: string) {
  return new Hono<ServerAppEnv>().get('/health', (context) =>
    context.json({ status: 'ok', edition: editionId }),
  )
}
