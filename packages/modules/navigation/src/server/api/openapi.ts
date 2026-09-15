import { createRoute, z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'

import {
  adminNavigationSchema,
  catalogSchema,
  navigationResponseSchema,
  publishSchema,
  roleGrantsSchema,
  saveDraftSchema,
  saveRoleGrantsSchema,
  validationResultSchema,
  versionSchema,
} from '../../shared/index.js'

const json = <TSchema>(schema: TSchema) => ({
  'application/json': { schema },
})
const error = (description: string) => ({
  description,
  content: json(apiErrorSchema),
})
const authenticated = [{ [openApiSecurityNames.accessTokenCookie]: [] }]
const mutation = [
  {
    [openApiSecurityNames.accessTokenCookie]: [],
    [openApiSecurityNames.csrfHeader]: [],
  },
]
const versionParam = z.object({ id: z.uuid() })
const roleParam = z.object({ roleId: z.uuid() })

export const navigationApiRoutes = {
  bootstrap: createRoute({
    method: 'get',
    path: '/bootstrap',
    operationId: 'navigationGetBootstrap',
    tags: ['Navigation'],
    summary: '读取启动导航',
    request: {
      query: z.object({ tenantCode: z.string().trim().min(1).max(80).optional() }),
    },
    responses: {
      200: { description: '已发布的启动导航', content: json(navigationResponseSchema) },
      400: error('查询参数无效'),
      404: error('租户或导航版本不可用'),
      503: error('导航尚未发布或与当前 Edition 不兼容'),
      500: error('服务器内部错误'),
    },
  }),
  me: createRoute({
    method: 'get',
    path: '/me',
    operationId: 'navigationGetMine',
    tags: ['Navigation'],
    summary: '读取当前用户可见导航',
    security: authenticated,
    responses: {
      200: { description: '当前用户可见导航', content: json(navigationResponseSchema) },
      401: error('尚未登录'),
      503: error('导航尚未发布或与当前 Edition 不兼容'),
      500: error('服务器内部错误'),
    },
  }),
  admin: createRoute({
    method: 'get',
    path: '/admin',
    operationId: 'navigationGetAdminOverview',
    tags: ['Navigation'],
    summary: '读取导航管理概览',
    security: authenticated,
    responses: {
      200: { description: '发布指针和版本列表', content: json(adminNavigationSchema) },
      401: error('尚未登录'),
      403: error('缺少 navigation.view 权限'),
      500: error('服务器内部错误'),
    },
  }),
  catalog: createRoute({
    method: 'get',
    path: '/catalog',
    operationId: 'navigationGetCatalog',
    tags: ['Navigation'],
    summary: '读取导航配置目录',
    security: authenticated,
    responses: {
      200: { description: '路由定义和可授权角色', content: json(catalogSchema) },
      401: error('尚未登录'),
      403: error('缺少 navigation.view 权限'),
      500: error('服务器内部错误'),
    },
  }),
  createDraft: createRoute({
    method: 'post',
    path: '/drafts',
    operationId: 'navigationCreateDraft',
    tags: ['Navigation'],
    summary: '创建导航草稿',
    security: mutation,
    request: {
      body: {
        required: true,
        content: json(z.object({ sourceVersionId: z.uuid().nullable() }).strict()),
      },
    },
    responses: {
      201: { description: '已创建草稿', content: json(versionSchema) },
      400: error('请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('来源版本不存在'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  getVersion: createRoute({
    method: 'get',
    path: '/versions/{id}',
    operationId: 'navigationGetVersion',
    tags: ['Navigation'],
    summary: '读取导航版本',
    security: authenticated,
    request: { params: versionParam },
    responses: {
      200: { description: '导航版本', content: json(versionSchema) },
      400: error('版本 ID 无效'),
      401: error('尚未登录'),
      403: error('缺少 navigation.view 权限'),
      404: error('版本不存在'),
      500: error('服务器内部错误'),
    },
  }),
  saveVersion: createRoute({
    method: 'put',
    path: '/versions/{id}',
    operationId: 'navigationSaveVersion',
    tags: ['Navigation'],
    summary: '保存导航草稿',
    security: mutation,
    request: {
      params: versionParam,
      body: { required: true, content: json(saveDraftSchema) },
    },
    responses: {
      200: { description: '已保存版本', content: json(versionSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('编辑版本冲突'),
      415: error('Content-Type 不受支持'),
      422: error('导航配置校验失败'),
      500: error('服务器内部错误'),
    },
  }),
  validateVersion: createRoute({
    method: 'post',
    path: '/versions/{id}/validate',
    operationId: 'navigationValidateVersion',
    tags: ['Navigation'],
    summary: '校验导航版本',
    security: mutation,
    request: { params: versionParam },
    responses: {
      200: { description: '校验结果', content: json(validationResultSchema) },
      400: error('版本 ID 无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      500: error('服务器内部错误'),
    },
  }),
  publishVersion: createRoute({
    method: 'post',
    path: '/versions/{id}/publish',
    operationId: 'navigationPublishVersion',
    tags: ['Navigation'],
    summary: '发布导航版本',
    security: mutation,
    request: {
      params: versionParam,
      body: { required: true, content: json(publishSchema) },
    },
    responses: {
      200: { description: '已发布版本', content: json(versionSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('发布指针或编辑版本冲突'),
      415: error('Content-Type 不受支持'),
      422: error('导航配置校验失败'),
      500: error('服务器内部错误'),
    },
  }),
  rollbackVersion: createRoute({
    method: 'post',
    path: '/versions/{id}/rollback',
    operationId: 'navigationRollbackVersion',
    tags: ['Navigation'],
    summary: '回滚到历史导航版本',
    security: mutation,
    request: {
      params: versionParam,
      body: { required: true, content: json(publishSchema) },
    },
    responses: {
      200: { description: '已重新发布的历史版本', content: json(versionSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('发布指针或编辑版本冲突'),
      415: error('Content-Type 不受支持'),
      422: error('导航配置校验失败'),
      500: error('服务器内部错误'),
    },
  }),
  deleteDraft: createRoute({
    method: 'delete',
    path: '/versions/{id}',
    operationId: 'navigationDeleteDraft',
    tags: ['Navigation'],
    summary: '删除未发布的导航草稿',
    security: mutation,
    request: { params: versionParam },
    responses: {
      200: {
        description: '已删除的草稿版本 ID',
        content: json(z.object({ id: z.uuid() }).strict()),
      },
      400: error('版本 ID 无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('仅能删除未发布的草稿版本'),
      500: error('服务器内部错误'),
    },
  }),
  getRoleGrants: createRoute({
    method: 'get',
    path: '/roles/{roleId}/grants',
    operationId: 'navigationGetRoleGrants',
    tags: ['Navigation'],
    summary: '读取角色导航授权',
    security: authenticated,
    request: { params: roleParam },
    responses: {
      200: { description: '角色获授的导航 code', content: json(roleGrantsSchema) },
      400: error('角色 ID 无效'),
      401: error('尚未登录'),
      403: error('缺少 navigation.view 权限'),
      404: error('角色不存在'),
      500: error('服务器内部错误'),
    },
  }),
  saveRoleGrants: createRoute({
    method: 'put',
    path: '/roles/{roleId}/grants',
    operationId: 'navigationSaveRoleGrants',
    tags: ['Navigation'],
    summary: '保存角色导航授权',
    security: mutation,
    request: {
      params: roleParam,
      body: { required: true, content: json(saveRoleGrantsSchema) },
    },
    responses: {
      200: { description: '保存后的角色导航授权', content: json(roleGrantsSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('角色不存在'),
      409: error('授权版本冲突'),
      415: error('Content-Type 不受支持'),
      422: error('导航尚未发布或授权 code 无效'),
      500: error('服务器内部错误'),
    },
  }),
} as const

export const navigationOpenApiContract = {
  id: 'navigation',
  title: 'Navigation',
  basePath: '/navigation',
  routes: Object.values(navigationApiRoutes),
} as const
