import { createRoute } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'

import {
  loginInputSchema,
  loginResultSchema,
  refreshSessionResultSchema,
  sessionStatusSchema,
} from '../../shared/index.js'

const json = <TSchema>(schema: TSchema) => ({
  'application/json': { schema },
})
const error = (description: string) => ({
  description,
  content: json(apiErrorSchema),
})

export const iamApiRoutes = {
  createSession: createRoute({
    method: 'post',
    path: '/sessions',
    operationId: 'iamCreateSession',
    tags: ['IAM'],
    summary: '登录并创建会话',
    description:
      '验证租户和凭据，创建服务端 opaque token family，并通过 Set-Cookie 写入 HttpOnly Access/Refresh Cookie 与可读的 CSRF Cookie。',
    request: {
      body: {
        required: true,
        content: json(loginInputSchema),
      },
    },
    responses: {
      201: { description: '登录成功', content: json(loginResultSchema) },
      400: error('请求体无效'),
      401: error('凭据无效'),
      403: error('Origin 校验失败'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  getSession: createRoute({
    method: 'get',
    path: '/session',
    operationId: 'iamGetSession',
    tags: ['IAM'],
    summary: '读取当前会话状态',
    description: '未登录也是正常状态，以 authenticated=false 返回，不使用 401 表示匿名。',
    responses: {
      200: { description: '当前会话状态', content: json(sessionStatusSchema) },
      500: error('服务器内部错误'),
    },
  }),
  refreshSession: createRoute({
    method: 'post',
    path: '/sessions/refresh',
    operationId: 'iamRefreshSession',
    tags: ['IAM'],
    summary: '轮换刷新令牌并续期访问令牌',
    description:
      '使用仅发送到本端点的 HttpOnly Refresh Token Cookie 轮换 token family，并重新签发短期 Access Token Cookie。要求 Origin 与双提交 CSRF 校验。',
    security: [
      {
        [openApiSecurityNames.refreshTokenCookie]: [],
        [openApiSecurityNames.csrfHeader]: [],
      },
    ],
    responses: {
      200: { description: '刷新成功', content: json(refreshSessionResultSchema) },
      401: error('刷新令牌无效、过期、已复用或会话已撤销'),
      403: error('Origin 或 CSRF 校验失败'),
      409: error('同一刷新令牌正在被另一个并发请求轮换'),
      500: error('服务器内部错误'),
    },
  }),
  deleteSession: createRoute({
    method: 'delete',
    path: '/sessions/current',
    operationId: 'iamDeleteCurrentSession',
    tags: ['IAM'],
    summary: '退出当前会话',
    security: [
      {
        [openApiSecurityNames.accessTokenCookie]: [],
        [openApiSecurityNames.csrfHeader]: [],
      },
    ],
    responses: {
      204: { description: '会话已撤销' },
      401: error('尚未登录'),
      403: error('Origin 或 CSRF 校验失败'),
      500: error('服务器内部错误'),
    },
  }),
} as const

export const iamOpenApiContract = {
  id: 'iam',
  title: 'IAM',
  basePath: '/iam',
  routes: Object.values(iamApiRoutes),
} as const
