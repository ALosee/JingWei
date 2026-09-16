import {
  createModuleApiClient,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  organizationMemberCandidateListSchema,
  organizationMemberListSchema,
  organizationMemberPositionListSchema,
  organizationMemberRefSchema,
  organizationMemberSchema,
  organizationPositionListSchema,
  organizationPositionRefSchema,
  organizationPositionSchema,
  organizationTreeSchema,
  organizationalScopeOptionsSchema,
  organizationUnitRefSchema,
  organizationUnitSchema,
  type CreateOrganizationMember,
  type CreateOrganizationPosition,
  type CreateOrganizationUnit,
  type OrganizationMember,
  type OrganizationMemberPosition,
  type OrganizationMemberUser,
  type OrganizationPosition,
  type OrganizationTree,
  type OrganizationUnit,
  type OrganizationalScopeOptions,
  type ReplaceOrganizationMemberPositions,
  type UpdateOrganizationMember,
  type UpdateOrganizationPosition,
  type UpdateOrganizationUnit,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/organization'>('/api/v1/organization')

export function listOrganizationalScopeOptions(
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationalScopeOptions>> {
  return toApiResult(
    api.client.get('/scope-options', {
      schema: organizationalScopeOptionsSchema,
      ...options,
    }),
  )
}

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

export function listOrganizationMembers(
  orgUnitId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ members: OrganizationMember[] }>> {
  return toApiResult(
    api.client.get('/org-units/{id}/members', {
      pathParams: { id: orgUnitId },
      schema: organizationMemberListSchema,
      ...options,
    }),
  )
}

export function listOrganizationMemberCandidates(
  options?: ApiRequestOptions,
): Promise<ApiResult<{ users: OrganizationMemberUser[] }>> {
  return toApiResult(
    api.client.get('/member-candidates', {
      schema: organizationMemberCandidateListSchema,
      ...options,
    }),
  )
}

export function createOrganizationMember(
  orgUnitId: string,
  input: CreateOrganizationMember,
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationMember>> {
  const body = {
    userId: input.userId,
    ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
    ...(input.joinedAt === undefined ? {} : { joinedAt: input.joinedAt }),
    ...(input.positionIds === undefined ? {} : { positionIds: input.positionIds }),
  }
  return toApiResult(
    api.client.post('/org-units/{id}/members', {
      pathParams: { id: orgUnitId },
      body,
      schema: organizationMemberSchema,
      ...options,
    }),
  )
}

export function updateOrganizationMember(
  orgUnitId: string,
  userId: string,
  input: UpdateOrganizationMember,
  options?: ApiRequestOptions,
): Promise<ApiResult<OrganizationMember>> {
  const body = {
    ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
    ...(input.joinedAt === undefined ? {} : { joinedAt: input.joinedAt }),
  }
  return toApiResult(
    api.client.patch('/org-units/{id}/members/{userId}', {
      pathParams: { id: orgUnitId, userId },
      body,
      schema: organizationMemberSchema,
      ...options,
    }),
  )
}

export function deleteOrganizationMember(
  orgUnitId: string,
  userId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ orgUnitId: string; userId: string }>> {
  return toApiResult(
    api.client.delete('/org-units/{id}/members/{userId}', {
      pathParams: { id: orgUnitId, userId },
      schema: organizationMemberRefSchema,
      ...options,
    }),
  )
}

export function replaceOrganizationMemberPositions(
  orgUnitId: string,
  userId: string,
  input: ReplaceOrganizationMemberPositions,
  options?: ApiRequestOptions,
): Promise<ApiResult<{ positions: OrganizationMemberPosition[] }>> {
  return toApiResult(
    api.client.put('/org-units/{id}/members/{userId}/positions', {
      pathParams: { id: orgUnitId, userId },
      body: {
        assignments: input.assignments.map((assignment) => ({
          positionId: assignment.positionId,
          ...(assignment.isPrimary === undefined ? {} : { isPrimary: assignment.isPrimary }),
        })),
      },
      schema: organizationMemberPositionListSchema,
      ...options,
    }),
  )
}
