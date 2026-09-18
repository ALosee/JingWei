import { z } from 'zod'

import {
  createModuleApiClient,
  executeApiRequest,
  postFormData,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  brandAdminSchema,
  brandAssetSchema,
  brandVersionSchema,
  effectiveBrandSchema,
  type BrandAdmin,
  type BrandAsset,
  type BrandAssetPurpose,
  type BrandDraftSource,
  type BrandVersion,
  type EffectiveBrand,
  type PublishBrand,
  type SaveBrandDraft,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/branding'>('/api/v1/branding')

export function getBrandBootstrap(tenantCode?: string): Promise<EffectiveBrand> {
  return executeApiRequest(() =>
    api.throwingClient.get('/bootstrap', {
      ...(tenantCode === undefined ? {} : { query: { tenantCode } }),
      schema: effectiveBrandSchema,
      timeout: 5_000,
    }),
  )
}

export function getBrandAssetText(id: string): Promise<string> {
  return executeApiRequest(() =>
    api.throwingClient.get('/assets/{id}', {
      pathParams: { id },
      responseType: 'text',
      timeout: 5_000,
    }),
  )
}

export function getBrandAdmin(options?: ApiRequestOptions): Promise<ApiResult<BrandAdmin>> {
  return toApiResult(api.client.get('/admin', { schema: brandAdminSchema, ...options }))
}

export function getBrandVersion(
  id: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<BrandVersion>> {
  return toApiResult(
    api.client.get('/versions/{id}', {
      pathParams: { id },
      schema: brandVersionSchema,
      ...options,
    }),
  )
}

export function createBrandDraft(
  source: BrandDraftSource,
  options?: ApiRequestOptions,
): Promise<ApiResult<BrandVersion>> {
  return toApiResult(
    api.client.post('/drafts', {
      body: { source },
      schema: brandVersionSchema,
      ...options,
    }),
  )
}

export function saveBrandDraft(
  id: string,
  input: SaveBrandDraft,
  options?: ApiRequestOptions,
): Promise<ApiResult<BrandVersion>> {
  return toApiResult(
    api.client.put('/versions/{id}', {
      pathParams: { id },
      body: input,
      schema: brandVersionSchema,
      ...options,
    }),
  )
}

export function publishBrandVersion(
  id: string,
  input: PublishBrand,
  rollback: boolean,
  options?: ApiRequestOptions,
): Promise<ApiResult<BrandVersion>> {
  return rollback
    ? toApiResult(
        api.client.post('/versions/{id}/rollback', {
          pathParams: { id },
          body: input,
          schema: brandVersionSchema,
          ...options,
        }),
      )
    : toApiResult(
        api.client.post('/versions/{id}/publish', {
          pathParams: { id },
          body: input,
          schema: brandVersionSchema,
          ...options,
        }),
      )
}

export function deleteBrandDraft(
  id: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ id: string }>> {
  return toApiResult(
    api.client.delete('/versions/{id}', {
      pathParams: { id },
      schema: z.object({ id: z.uuid() }).strict(),
      ...options,
    }),
  )
}

export function restoreDefaultBrand(
  expectedPublishedVersionId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ publishedVersionId: null }>> {
  return toApiResult(
    api.client.post('/restore-default', {
      body: { expectedPublishedVersionId },
      schema: z.object({ publishedVersionId: z.null() }).strict(),
      ...options,
    }),
  )
}

export function uploadBrandAsset(
  purpose: BrandAssetPurpose,
  file: File,
  options?: ApiRequestOptions,
): Promise<ApiResult<BrandAsset>> {
  const body = new FormData()
  body.set('purpose', purpose)
  body.set('file', file)
  return postFormData('/api/v1/branding/assets', body, brandAssetSchema, options)
}
