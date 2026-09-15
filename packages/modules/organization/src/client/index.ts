import {
  createModuleApiClient,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  organizationPositionListSchema,
  organizationPositionRefSchema,
  organizationPositionSchema,
  organizationTreeSchema,
  organizationUnitRefSchema,
  organizationUnitSchema,
  type CreateOrganizationPosition,
  type CreateOrganizationUnit,
  type OrganizationPosition,
  type OrganizationTree,
  type OrganizationUnit,
  type UpdateOrganizationPosition,
  type UpdateOrganizationUnit,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/organization'>('/api/v1/organization')

export function getOrganizationTree(
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationTree>> {
  return toApiResult(
    api.client.get('/org-units', {
      schema: organizationTreeSchema,
      ...options,
    }),
  )
}

export function createOrganizationUnit(
  input: CreateOrganizationUnit,
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationUnit>> {
  const body = {
    parentId: input.parentId,
    code: input.code,
    name: input.name,
    type: input.type,
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  }
  return toApiResult(
    api.client.post('/org-units', {
      body,
      schema: organizationUnitSchema,
      ...options,
    }),
  )
}

export function updateOrganizationUnit(
  id: string,
  input: UpdateOrganizationUnit,
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationUnit>> {
  const body = {
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    ...(input.code === undefined ? {} : { code: input.code }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  }
  return toApiResult(
    api.client.patch('/org-units/{id}', {
      pathParams: { id },
      body,
      schema: organizationUnitSchema,
      ...options,
    }),
  )
}

export function deleteOrganizationUnit(
  id: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ id: string }>> {
  return toApiResult(
    api.client.delete('/org-units/{id}', {
      pathParams: { id },
      schema: organizationUnitRefSchema,
      ...options,
    }),
  )
}

export function listOrganizationPositions(
  orgUnitId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ positions: OrganizationPosition[] }>> {
  return toApiResult(
    api.client.get('/org-units/{id}/positions', {
      pathParams: { id: orgUnitId },
      schema: organizationPositionListSchema,
      ...options,
    }),
  )
}

export function createOrganizationPosition(
  orgUnitId: string,
  input: CreateOrganizationPosition,
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationPosition>> {
  const body = {
    code: input.code,
    name: input.name,
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  }
  return toApiResult(
    api.client.post('/org-units/{id}/positions', {
      pathParams: { id: orgUnitId },
      body,
      schema: organizationPositionSchema,
      ...options,
    }),
  )
}

export function updateOrganizationPosition(
  orgUnitId: string,
  positionId: string,
  input: UpdateOrganizationPosition,
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationPosition>> {
  const body = {
    ...(input.code === undefined ? {} : { code: input.code }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  }
  return toApiResult(
    api.client.patch('/org-units/{id}/positions/{positionId}', {
      pathParams: { id: orgUnitId, positionId },
      body,
      schema: organizationPositionSchema,
      ...options,
    }),
  )
}

export function deleteOrganizationPosition(
  orgUnitId: string,
  positionId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ id: string }>> {
  return toApiResult(
    api.client.delete('/org-units/{id}/positions/{positionId}', {
      pathParams: { id: orgUnitId, positionId },
      schema: organizationPositionRefSchema,
      ...options,
    }),
  )
}
