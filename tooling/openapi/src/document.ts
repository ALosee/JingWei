import { OpenAPIHono, type RouteConfig } from '@hono/zod-openapi'

import { accessTokenCookieName, csrfHeaderName, refreshTokenCookieName } from '@jingwei/auth/shared'
import {
  platformAccessTokenCookieName,
  platformCsrfHeaderName,
  platformRefreshTokenCookieName,
} from '@jingwei/control-plane/shared'
import { openApiSecurityNames } from '@jingwei/http-contract'

export interface ModuleOpenApiContract {
  readonly id: string
  readonly title: string
  readonly basePath: string
  readonly clientOutput?: string
  readonly routes: readonly RouteConfig[]
}

export function createModuleOpenApiDocument(contract: ModuleOpenApiContract) {
  const app = new OpenAPIHono()
  app.openAPIRegistry.registerComponent('securitySchemes', openApiSecurityNames.accessTokenCookie, {
    type: 'apiKey',
    in: 'cookie',
    name: accessTokenCookieName,
  })
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.refreshTokenCookie,
    {
      type: 'apiKey',
      in: 'cookie',
      name: refreshTokenCookieName,
    },
  )
  app.openAPIRegistry.registerComponent('securitySchemes', openApiSecurityNames.csrfHeader, {
    type: 'apiKey',
    in: 'header',
    name: csrfHeaderName,
  })
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.platformAccessTokenCookie,
    { type: 'apiKey', in: 'cookie', name: platformAccessTokenCookieName },
  )
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.platformRefreshTokenCookie,
    { type: 'apiKey', in: 'cookie', name: platformRefreshTokenCookieName },
  )
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    openApiSecurityNames.platformCsrfHeader,
    { type: 'apiKey', in: 'header', name: platformCsrfHeaderName },
  )

  for (const route of contract.routes) {
    app.openAPIRegistry.registerPath({
      ...route,
      path: `/api/v1${contract.basePath}${route.path}`,
    })
  }

  return app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: `Jingwei ${contract.title} API`,
      version: '1.0.0',
    },
  })
}
