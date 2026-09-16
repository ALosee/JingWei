import {
  createModuleApiClient,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  dictionaryCatalogSchema,
  dictionaryCategorySchema,
  dictionaryRefSchema,
  dictionaryTypeDetailSchema,
  type CreateDictionaryCategory,
  type CreateDictionaryItem,
  type CreateDictionaryType,
  type DictionaryCatalog,
  type DictionaryCategory,
  type DictionaryTypeDetail,
  type UpdateDictionaryCategory,
  type UpdateDictionaryItem,
  type UpdateDictionaryType,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/dictionary'>('/api/v1/dictionary')

export function getDictionaryCatalog(
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryCatalog>> {
  return toApiResult(api.client.get('/catalog', { schema: dictionaryCatalogSchema, ...options }))
}

export function getDictionaryType(
  id: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryTypeDetail>> {
  return toApiResult(
    api.client.get('/types/{id}', {
      pathParams: { id },
      schema: dictionaryTypeDetailSchema,
      ...options,
    }),
  )
}

export function getDictionaryTypeByCode(
  code: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryTypeDetail>> {
  return toApiResult(
    api.client.get('/types/by-code/{code}', {
      pathParams: { code },
      schema: dictionaryTypeDetailSchema,
      ...options,
    }),
  )
}

export function createDictionaryCategory(
  input: CreateDictionaryCategory,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryCategory>> {
  return toApiResult(
    api.client.post('/categories', {
      body: {
        code: input.code,
        name: input.name,
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
      schema: dictionaryCategorySchema,
      ...options,
    }),
  )
}

export function updateDictionaryCategory(
  id: string,
  input: UpdateDictionaryCategory,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryCategory>> {
  return toApiResult(
    api.client.patch('/categories/{id}', {
      pathParams: { id },
      body: {
        expectedRevision: input.expectedRevision,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
      schema: dictionaryCategorySchema,
      ...options,
    }),
  )
}

export function deleteDictionaryCategory(
  id: string,
  expectedRevision: number,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ id: string }>> {
  return toApiResult(
    api.client.delete('/categories/{id}', {
      pathParams: { id },
      query: { expectedRevision },
      schema: dictionaryRefSchema,
      ...options,
    }),
  )
}

export function createDictionaryType(
  input: CreateDictionaryType,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryTypeDetail>> {
  return toApiResult(
    api.client.post('/types', {
      body: {
        categoryId: input.categoryId,
        code: input.code,
        name: input.name,
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      schema: dictionaryTypeDetailSchema,
      ...options,
    }),
  )
}

export function updateDictionaryType(
  id: string,
  input: UpdateDictionaryType,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryTypeDetail>> {
  return toApiResult(
    api.client.patch('/types/{id}', {
      pathParams: { id },
      body: {
        expectedRevision: input.expectedRevision,
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      schema: dictionaryTypeDetailSchema,
      ...options,
    }),
  )
}

export function createDictionaryItem(
  typeId: string,
  input: CreateDictionaryItem,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryTypeDetail>> {
  return toApiResult(
    api.client.post('/types/{id}/items', {
      pathParams: { id: typeId },
      body: {
        code: input.code,
        label: input.label,
        expectedRevision: input.expectedRevision,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
      schema: dictionaryTypeDetailSchema,
      ...options,
    }),
  )
}

export function updateDictionaryItem(
  typeId: string,
  itemId: string,
  input: UpdateDictionaryItem,
  options?: ApiRequestOptions,
): Promise<ApiResult<DictionaryTypeDetail>> {
  return toApiResult(
    api.client.patch('/types/{id}/items/{itemId}', {
      pathParams: { id: typeId, itemId },
      body: {
        expectedRevision: input.expectedRevision,
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
      schema: dictionaryTypeDetailSchema,
      ...options,
    }),
  )
}
