import type { OpenAPIHono } from '@hono/zod-openapi'

import { csrfHeaderName, sessionCookieName } from '@jingwei/auth/shared'
import { openApiSecurityNames } from '@jingwei/http-contract'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

export const openApiDocumentConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Jingwei HTTP API',
    version: '1.0.0',
    description:
      'Jingwei 平台 HTTP API。业务接口位于 /api/v1；会话使用 HttpOnly Cookie，修改请求同时要求 Origin 与双提交 CSRF Token。',
  },
} as const

export function registerOpenApiSecuritySchemes(app: OpenAPIHono<ServerAppEnv>): void {
  app.openAPIRegistry.registerComponent('securitySchemes', openApiSecurityNames.sessionCookie, {
    type: 'apiKey',
    in: 'cookie',
    name: sessionCookieName,
    description: '服务端会话 Cookie，由登录接口通过 Set-Cookie 写入，浏览器 JavaScript 不可读取。',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', openApiSecurityNames.csrfHeader, {
    type: 'apiKey',
    in: 'header',
    name: csrfHeaderName,
    description: '修改请求使用的双提交 CSRF Token；值与 jingwei_csrf Cookie 相同。',
  })
}
