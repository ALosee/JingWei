import type { OpenAPIHono } from '@hono/zod-openapi'

import { accessTokenCookieName, csrfHeaderName, refreshTokenCookieName } from '@jingwei/auth/shared'
import {
  platformAccessTokenCookieName,
  platformCsrfHeaderName,
  platformRefreshTokenCookieName,
} from '@jingwei/control-plane/shared'
import { openApiSecurityNames } from '@jingwei/http-contract'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'

export const openApiDocumentConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Jingwei HTTP API',
    version: '1.0.0',
    description:
      'Jingwei 平台 HTTP API。业务接口位于 /api/v1；Web 会话使用 HttpOnly Access/Refresh Cookie，修改请求同时要求 Origin 与双提交 CSRF Token。',
  },
} as const

export function registerOpenApiSecuritySchemes(app: OpenAPIHono<ServerAppEnv>): void {
  app.openAPIRegistry.registerComponent('securitySchemes', openApiSecurityNames.accessTokenCookie, {
    type: 'apiKey',
    in: 'cookie',
    name: accessTokenCookieName,
    description: '短期 opaque Access Token，由浏览器作为 HttpOnly Cookie 自动携带。',
  })
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.refreshTokenCookie,
    {
      type: 'apiKey',
      in: 'cookie',
      name: refreshTokenCookieName,
      description: '单次使用的 opaque Refresh Token，仅发送到会话刷新端点。',
    },
  )
  app.openAPIRegistry.registerComponent('securitySchemes', openApiSecurityNames.csrfHeader, {
    type: 'apiKey',
    in: 'header',
    name: csrfHeaderName,
    description: '修改请求使用的双提交 CSRF Token；值与 jingwei_csrf Cookie 相同。',
  })
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.platformAccessTokenCookie,
    {
      type: 'apiKey',
      in: 'cookie',
      name: platformAccessTokenCookieName,
      description: '平台控制面短期 opaque Access Token。',
    },
  )
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.platformRefreshTokenCookie,
    {
      type: 'apiKey',
      in: 'cookie',
      name: platformRefreshTokenCookieName,
      description: '平台控制面单次轮换 Refresh Token。',
    },
  )
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.platformCsrfHeader,
    {
      type: 'apiKey',
      in: 'header',
      name: platformCsrfHeaderName,
      description: '平台控制面双提交 CSRF Token。',
    },
  )
}
