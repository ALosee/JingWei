import { z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'
import {
  createApiRoute,
  platformAuthenticatedApiAccess,
  platformRefreshTokenApiAccess,
  publicApiAccess,
} from '@jingwei/module-sdk/server'

import {
  createPlatformTenantSchema,
  platformLoginInputSchema,
  platformLoginResultSchema,
  platformRefreshSessionResultSchema,
  platformSessionStatusSchema,
  platformTenantListSchema,
  platformTenantSchema,
  retryPlatformTenantSchema,
} from '../../shared/index.js'

const json = <TSchema>(schema: TSchema) => ({ 'application/json': { schema } })
const error = (description: string) => ({ description, content: json(apiErrorSchema) })
const authenticated = [{ [openApiSecurityNames.platformAccessTokenCookie]: [] }]
const mutation = [
  {
    [openApiSecurityNames.platformAccessTokenCookie]: [],
    [openApiSecurityNames.platformCsrfHeader]: [],
  },
]
const refresh = [
  {
    [openApiSecurityNames.platformRefreshTokenCookie]: [],
    [openApiSecurityNames.platformCsrfHeader]: [],
  },
]
const tenantParam = z.object({ tenantId: z.uuid() })

export const controlPlaneApiRoutes = {
  createSession: createApiRoute(publicApiAccess, {
    method: 'post',
    path: '/sessions',
    operationId: 'platformCreateSession',
    tags: ['Platform Control Plane'],
    summary: '平台管理员登录',
    request: { body: { required: true, content: json(platformLoginInputSchema) } },
    responses: {
      201: { description: '登录成功', content: json(platformLoginResultSchema) },
      400: error('请求无效'),
      401: error('凭据无效'),
      403: error('Origin 校验失败'),
      500: error('服务器内部错误'),
    },
  }),
  getSession: createApiRoute(publicApiAccess, {
    method: 'get',
    path: '/session',
    operationId: 'platformGetSession',
    tags: ['Platform Control Plane'],
    summary: '读取平台管理员会话',
    responses: {
      200: { description: '会话状态', content: json(platformSessionStatusSchema) },
      500: error('服务器内部错误'),
    },
  }),
  refreshSession: createApiRoute(platformRefreshTokenApiAccess, {
    method: 'post',
    path: '/sessions/refresh',
    operationId: 'platformRefreshSession',
    tags: ['Platform Control Plane'],
    summary: '轮换平台管理员刷新令牌',
    security: refresh,
    responses: {
      200: { description: '刷新成功', content: json(platformRefreshSessionResultSchema) },
      401: error('刷新令牌无效'),
      403: error('Origin 或 CSRF 校验失败'),
      409: error('刷新令牌正在轮换'),
      500: error('服务器内部错误'),
    },
  }),
  deleteSession: createApiRoute(platformAuthenticatedApiAccess, {
    method: 'delete',
    path: '/sessions/current',
    operationId: 'platformDeleteSession',
    tags: ['Platform Control Plane'],
    summary: '退出平台管理后台',
    security: mutation,
    responses: {
      204: { description: '退出成功' },
      401: error('尚未登录'),
      403: error('Origin 或 CSRF 校验失败'),
      500: error('服务器内部错误'),
    },
  }),
  listTenants: createApiRoute(platformAuthenticatedApiAccess, {
    method: 'get',
    path: '/tenants',
    operationId: 'platformListTenants',
    tags: ['Platform Tenants'],
    summary: '列出全部租户',
    security: authenticated,
    responses: {
      200: { description: '租户列表', content: json(platformTenantListSchema) },
      401: error('尚未登录'),
      500: error('服务器内部错误'),
    },
  }),
  createTenant: createApiRoute(platformAuthenticatedApiAccess, {
    method: 'post',
    path: '/tenants',
    operationId: 'platformCreateTenant',
    tags: ['Platform Tenants'],
    summary: '创建并初始化租户',
    security: mutation,
    request: { body: { required: true, content: json(createPlatformTenantSchema) } },
    responses: {
      201: { description: '创建完成的租户', content: json(platformTenantSchema) },
      400: error('租户或管理员信息无效'),
      401: error('尚未登录'),
      403: error('Origin 或 CSRF 校验失败'),
      409: error('租户代码或状态冲突'),
      422: error('租户初始化失败'),
      500: error('服务器内部错误'),
    },
  }),
  getTenant: createApiRoute(platformAuthenticatedApiAccess, {
    method: 'get',
    path: '/tenants/{tenantId}',
    operationId: 'platformGetTenant',
    tags: ['Platform Tenants'],
    summary: '读取租户详情',
    security: authenticated,
    request: { params: tenantParam },
    responses: {
      200: { description: '租户详情', content: json(platformTenantSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      404: error('租户不存在'),
      500: error('服务器内部错误'),
    },
  }),
  retryTenant: createApiRoute(platformAuthenticatedApiAccess, {
    method: 'post',
    path: '/tenants/{tenantId}/retry',
    operationId: 'platformRetryTenant',
    tags: ['Platform Tenants'],
    summary: '重试租户初始化',
    security: mutation,
    request: {
      params: tenantParam,
      body: { required: true, content: json(retryPlatformTenantSchema) },
    },
    responses: {
      200: { description: '初始化完成的租户', content: json(platformTenantSchema) },
      400: error('请求无效'),
      401: error('尚未登录'),
      403: error('Origin 或 CSRF 校验失败'),
      404: error('租户不存在'),
      409: error('租户状态冲突'),
      500: error('服务器内部错误'),
    },
  }),
  suspendTenant: lifecycleRoute('suspend', '暂停租户'),
  resumeTenant: lifecycleRoute('resume', '恢复租户'),
  disableTenant: lifecycleRoute('disable', '停用租户'),
} as const

function lifecycleRoute(action: 'suspend' | 'resume' | 'disable', summary: string) {
  return createApiRoute(platformAuthenticatedApiAccess, {
    method: 'post',
    path: `/tenants/{tenantId}/${action}`,
    operationId: `platform${action[0]?.toUpperCase()}${action.slice(1)}Tenant`,
    tags: ['Platform Tenants'],
    summary,
    security: mutation,
    request: { params: tenantParam },
    responses: {
      200: { description: '更新后的租户', content: json(platformTenantSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      403: error('Origin 或 CSRF 校验失败'),
      404: error('租户不存在'),
      409: error('租户状态冲突'),
      500: error('服务器内部错误'),
    },
  })
}

export const controlPlaneOpenApiContract = {
  id: 'control-plane',
  title: 'Platform Control Plane',
  basePath: '/platform',
  clientOutput: 'packages/platform/control-plane/src/client/generated/openapi.ts',
  routes: Object.values(controlPlaneApiRoutes),
} as const
