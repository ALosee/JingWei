import { z } from '@hono/zod-openapi'

import { apiErrorSchema, openApiSecurityNames } from '@jingwei/http-contract'
import { createApiRoute, permissionApiAccess, publicApiAccess } from '@jingwei/module-sdk/server'

import {
  brandAdminSchema,
  brandAssetPurposes,
  brandAssetSchema,
  brandVersionSchema,
  createBrandDraftSchema,
  effectiveBrandSchema,
  publishBrandSchema,
  restoreDefaultBrandSchema,
  saveBrandDraftSchema,
} from '../../shared/index.js'
import { brandingPermissionRequirements } from '../application/authorization-requirements.js'

const json = <TSchema>(schema: TSchema) => ({ 'application/json': { schema } })
const error = (description: string) => ({ description, content: json(apiErrorSchema) })
const authenticated = [{ [openApiSecurityNames.accessTokenCookie]: [] }]
const mutation = [
  {
    [openApiSecurityNames.accessTokenCookie]: [],
    [openApiSecurityNames.csrfHeader]: [],
  },
]
const versionParam = z.object({ id: z.uuid() })
const viewAccess = permissionApiAccess(brandingPermissionRequirements.view)
const manageAccess = permissionApiAccess(brandingPermissionRequirements.manage)
const publishAccess = permissionApiAccess(brandingPermissionRequirements.publish)

export const brandingApiRoutes = {
  bootstrap: createApiRoute(publicApiAccess, {
    method: 'get',
    path: '/bootstrap',
    operationId: 'brandingGetBootstrap',
    tags: ['Branding'],
    summary: '读取租户生效品牌',
    request: { query: z.object({ tenantCode: z.string().trim().min(1).max(80).optional() }) },
    responses: {
      200: { description: '生效品牌，未发布时返回内置默认值', content: json(effectiveBrandSchema) },
      400: error('查询参数无效'),
      404: error('租户不可用'),
      500: error('服务器内部错误'),
    },
  }),
  asset: createApiRoute(publicApiAccess, {
    method: 'get',
    path: '/assets/{id}',
    operationId: 'brandingGetAsset',
    tags: ['Branding'],
    summary: '读取不可变品牌素材',
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: {
        description: 'PNG 或通过严格配置校验的 SVG 品牌素材',
        content: {
          'image/png': { schema: z.string().meta({ format: 'binary' }) },
          'image/svg+xml': { schema: z.string().meta({ format: 'binary' }) },
        },
      },
      400: error('素材 ID 无效'),
      404: error('素材不存在'),
      500: error('服务器内部错误'),
    },
  }),
  admin: createApiRoute(viewAccess, {
    method: 'get',
    path: '/admin',
    operationId: 'brandingGetAdminOverview',
    tags: ['Branding'],
    summary: '读取品牌版本概览',
    security: authenticated,
    responses: {
      200: { description: '品牌版本概览', content: json(brandAdminSchema) },
      401: error('尚未登录'),
      403: error('缺少 branding.view 权限'),
      500: error('服务器内部错误'),
    },
  }),
  createDraft: createApiRoute(manageAccess, {
    method: 'post',
    path: '/drafts',
    operationId: 'brandingCreateDraft',
    tags: ['Branding'],
    summary: '创建品牌草稿',
    security: mutation,
    request: {
      body: {
        required: true,
        content: json(createBrandDraftSchema),
      },
    },
    responses: {
      201: { description: '品牌草稿', content: json(brandVersionSchema) },
      400: error('请求体无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('来源版本不存在'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  getVersion: createApiRoute(viewAccess, {
    method: 'get',
    path: '/versions/{id}',
    operationId: 'brandingGetVersion',
    tags: ['Branding'],
    summary: '读取品牌版本',
    security: authenticated,
    request: { params: versionParam },
    responses: {
      200: { description: '品牌版本', content: json(brandVersionSchema) },
      400: error('版本 ID 无效'),
      401: error('尚未登录'),
      403: error('缺少 branding.view 权限'),
      404: error('版本不存在'),
      500: error('服务器内部错误'),
    },
  }),
  saveVersion: createApiRoute(manageAccess, {
    method: 'put',
    path: '/versions/{id}',
    operationId: 'brandingSaveVersion',
    tags: ['Branding'],
    summary: '保存品牌草稿',
    security: mutation,
    request: {
      params: versionParam,
      body: { required: true, content: json(saveBrandDraftSchema) },
    },
    responses: {
      200: { description: '已保存的品牌草稿', content: json(brandVersionSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('草稿编辑冲突'),
      415: error('Content-Type 不受支持'),
      422: error('素材引用无效'),
      500: error('服务器内部错误'),
    },
  }),
  publishVersion: createApiRoute(publishAccess, {
    method: 'post',
    path: '/versions/{id}/publish',
    operationId: 'brandingPublishVersion',
    tags: ['Branding'],
    summary: '发布品牌草稿',
    security: mutation,
    request: { params: versionParam, body: { required: true, content: json(publishBrandSchema) } },
    responses: {
      200: { description: '已发布品牌', content: json(brandVersionSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('发布冲突'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  rollbackVersion: createApiRoute(publishAccess, {
    method: 'post',
    path: '/versions/{id}/rollback',
    operationId: 'brandingRollbackVersion',
    tags: ['Branding'],
    summary: '回滚到历史品牌版本',
    security: mutation,
    request: { params: versionParam, body: { required: true, content: json(publishBrandSchema) } },
    responses: {
      200: { description: '已切换的品牌版本', content: json(brandVersionSchema) },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('回滚目标或发布指针无效'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  deleteDraft: createApiRoute(manageAccess, {
    method: 'delete',
    path: '/versions/{id}',
    operationId: 'brandingDeleteDraft',
    tags: ['Branding'],
    summary: '删除品牌草稿',
    security: mutation,
    request: { params: versionParam },
    responses: {
      200: { description: '已删除草稿', content: json(z.object({ id: z.uuid() })) },
      400: error('版本 ID 无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      404: error('版本不存在'),
      409: error('已发布版本不可删除'),
      500: error('服务器内部错误'),
    },
  }),
  restoreDefault: createApiRoute(publishAccess, {
    method: 'post',
    path: '/restore-default',
    operationId: 'brandingRestoreDefault',
    tags: ['Branding'],
    summary: '恢复平台默认品牌',
    security: mutation,
    request: { body: { required: true, content: json(restoreDefaultBrandSchema) } },
    responses: {
      200: {
        description: '已恢复平台默认品牌',
        content: json(z.object({ publishedVersionId: z.null() }).strict()),
      },
      400: error('请求参数无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      409: error('发布指针冲突'),
      415: error('Content-Type 不受支持'),
      500: error('服务器内部错误'),
    },
  }),
  uploadAsset: createApiRoute(manageAccess, {
    method: 'post',
    path: '/assets',
    operationId: 'brandingUploadAsset',
    tags: ['Branding'],
    summary: '上传品牌素材',
    security: mutation,
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({
              purpose: z.enum(brandAssetPurposes),
              file: z
                .file()
                .max(512 * 1024)
                .openapi({ type: 'string', format: 'binary' }),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: '已上传素材', content: json(brandAssetSchema) },
      400: error('表单无效'),
      401: error('尚未登录'),
      403: error('权限、Origin 或 CSRF 校验失败'),
      413: error('文件过大'),
      415: error('Content-Type 不受支持'),
      422: error('图片内容或尺寸无效'),
      500: error('服务器内部错误'),
    },
  }),
} as const

export const brandingOpenApiContract = {
  id: 'branding',
  title: 'Branding',
  basePath: '/branding',
  routes: Object.values(brandingApiRoutes),
} as const
