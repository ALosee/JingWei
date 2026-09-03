import { Hono } from 'hono'

import type { ServerAppEnv, ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'

export const serverModule: ServerModule = {
  manifest,
  install() {
    return Promise.resolve({
      id: manifest.id,
      basePath: '/organization',
      routes: new Hono<ServerAppEnv>(),
    })
  },
}
