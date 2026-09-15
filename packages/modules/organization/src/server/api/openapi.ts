import { createRoute, z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'

import {
  createOrganizationPositionSchema,
  createOrganizationUnitSchema,
  organizationPositionListSchema,
  organizationPositionRefSchema,
  organizationPositionSchema,
  organizationTreeSchema,
  organizationUnitRefSchema,
  organizationUnitSchema,
  updateOrganizationPositionSchema,
  updateOrganizationUnitSchema,
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
const unitParam = z.object({ id: z.uuid() })
const unitPositionParam = z.object({ id: z.uuid(), positionId: z.uuid() })

export const organizationApiRoutes = {
  tree: createRoute({
    method: 'get',
    path: '/org-units',
    operationId: 'organizationGetTree',
    tags: ['Organization'],
    summary: '读取当前租户组织树',
    description: '返回扁平组织单元列表，客户端按 parentId 组装层级。',
    security: authenticated,
    responses: {
      200: { description: '组织单元列表', content: json(organizationTreeSchema) },
      401: error('尚未登录'),
      403: error('缺少 organization.view 权限'),
      500: error('服务器内部错误'),
    },
  }),
  create: createRoute({
    method: 'post',
    path: '/org-units',
    operationId: 'organizationCreateUnit',
    tags: ['Organization'],
    summary: '创建组织单元',
    security: mutation,
    request: {
      body: { required: true, content: json(createOrganizationUnitSchema) },
    },
    responses: {
      201: { description: '已创建的组织单元', content: json(organizationUnitSchema) },
      400: error('请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('上级组织不存在'),
      409: error('组织编码冲突'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  update: createRoute({
    method: 'patch',
    path: '/org-units/{id}',
    operationId: 'organizationUpdateUnit',
    tags: ['Organization'],
    summary: '更新组织单元',
    description: '可通过 parentId 移动节点；服务端拒绝将节点移动到自身或其后代。',
    security: mutation,
    request: {
      params: unitParam,
      body: { required: true, content: json(updateOrganizationUnitSchema) },
    },
    responses: {
      200: { description: '更新后的组织单元', content: json(organizationUnitSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('组织或上级组织不存在'),
      409: error('编码冲突或移动成环'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  remove: createRoute({
    method: 'delete',
    path: '/org-units/{id}',
    operationId: 'organizationDeleteUnit',
    tags: ['Organization'],
    summary: '删除组织单元',
    description: '仅允许删除无子节点、无成员、无岗位的空叶子；否则应改为禁用。',
    security: mutation,
    request: { params: unitParam },
    responses: {
      200: { description: '已删除的组织 ID', content: json(organizationUnitRefSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('组织不存在'),
      409: error('仍有子节点、成员或岗位'),
      500: error('服务器内部错误'),
    },
  }),
  listPositions: createRoute({
    method: 'get',
    path: '/org-units/{id}/positions',
    operationId: 'organizationListPositions',
    tags: ['Organization'],
    summary: '读取组织下的岗位',
    security: authenticated,
    request: { params: unitParam },
    responses: {
      200: { description: '岗位列表', content: json(organizationPositionListSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      403: error('缺少 organization.view 权限'),
      404: error('组织不存在'),
      500: error('服务器内部错误'),
    },
  }),
  createPosition: createRoute({
    method: 'post',
    path: '/org-units/{id}/positions',
    operationId: 'organizationCreatePosition',
    tags: ['Organization'],
    summary: '在组织下创建岗位',
    security: mutation,
    request: {
      params: unitParam,
      body: { required: true, content: json(createOrganizationPositionSchema) },
    },
    responses: {
      201: { description: '已创建的岗位', content: json(organizationPositionSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('组织不存在'),
      409: error('岗位编码冲突'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  updatePosition: createRoute({
    method: 'patch',
    path: '/org-units/{id}/positions/{positionId}',
    operationId: 'organizationUpdatePosition',
    tags: ['Organization'],
    summary: '更新岗位',
    security: mutation,
    request: {
      params: unitPositionParam,
      body: { required: true, content: json(updateOrganizationPositionSchema) },
    },
    responses: {
      200: { description: '更新后的岗位', content: json(organizationPositionSchema) },
      400: error('路径参数或请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('岗位不存在'),
      409: error('岗位编码冲突'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  removePosition: createRoute({
    method: 'delete',
    path: '/org-units/{id}/positions/{positionId}',
    operationId: 'organizationDeletePosition',
    tags: ['Organization'],
    summary: '删除岗位',
    description: '仅允许删除无用户占用的岗位；否则应改为停用。',
    security: mutation,
    request: { params: unitPositionParam },
    responses: {
      200: { description: '已删除的岗位 ID', content: json(organizationPositionRefSchema) },
      400: error('路径参数无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('岗位不存在'),
      409: error('仍有用户担任该岗位'),
      500: error('服务器内部错误'),
    },
  }),
} as const

export const organizationOpenApiContract = {
  id: 'organization',
  title: 'Organization',
  basePath: '/organization',
  routes: Object.values(organizationApiRoutes),
} as const
