import {
  createModuleApiClient,
  executeApiRequest,
  refreshCookieSession,
  toApiResult,
  type ApiRequestOptions,
  type ApiResult,
} from '@jingwei/api-client'

import {
  accountProfileSchema,
  accountRolesSchema,
  iamRoleListSchema,
  iamRoleRefSchema,
  iamRoleSchema,
  loginResultSchema,
  managedUserListSchema,
  managedUserSchema,
  permissionCatalogSchema,
  rolePermissionListSchema,
  sessionStatusSchema,
  userRoleListSchema,
  type AccountProfile,
  type AccountRoles,
  type ChangePasswordInput,
  type CreateIamRole,
  type CreateManagedUser,
  type LoginInput,
  type LoginResult,
  type PermissionCatalog,
  type ReplaceRolePermissions,
  type ReplaceUserRoles,
  type ResetManagedUserPassword,
  type RolePermissionList,
  type SessionStatus,
  type UpdateAccountInput,
  type UpdateIamRole,
  type UpdateManagedUser,
  type UserRoleList,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/iam'>('/api/v1/iam')

export function login(
  input: LoginInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<LoginResult>> {
  return toApiResult(
    api.client.post('/sessions', {
      body: input,
      schema: loginResultSchema,
      ...options,
    }),
  )
}

/**
 * Restores the HttpOnly-cookie session state and performs one refresh attempt when only the
 * long-lived cookie remains. Raw access and refresh tokens stay inaccessible to JavaScript.
 */
export async function getSessionStatus(): Promise<SessionStatus> {
  let status = await executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: sessionStatusSchema }),
  )
  if (status.authenticated || !(await refreshCookieSession())) return status

  status = await executeApiRequest(() =>
    api.throwingClient.get('/session', { schema: sessionStatusSchema }),
  )
  return status
}

export function logout(): Promise<void> {
  return executeApiRequest(() => api.throwingClient.delete('/sessions/current'))
}

export function getAccountProfile(options?: ApiRequestOptions): Promise<ApiResult<AccountProfile>> {
  return toApiResult(
    api.client.get('/account', {
      schema: accountProfileSchema,
      ...options,
    }),
  )
}

export function updateAccountProfile(
  input: UpdateAccountInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<AccountProfile>> {
  const body = {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
  }
  return toApiResult(
    api.client.patch('/account', {
      body,
      schema: accountProfileSchema,
      ...options,
    }),
  )
}

export function changeAccountPassword(
  input: ChangePasswordInput,
  options?: ApiRequestOptions,
): Promise<ApiResult<void>> {
  return toApiResult(
    api.client.post('/account/password', {
      body: input,
      ...options,
    }),
  )
}

export function getAccountRoles(options?: ApiRequestOptions): Promise<ApiResult<AccountRoles>> {
  return toApiResult(
    api.client.get('/account/roles', {
      schema: accountRolesSchema,
      ...options,
    }),
  )
}

export function listIamRoles(options?: ApiRequestOptions) {
  return toApiResult(
    api.client.get('/roles', {
      schema: iamRoleListSchema,
      ...options,
    }),
  )
}

export function createIamRole(input: CreateIamRole, options?: ApiRequestOptions) {
  const body = {
    code: input.code,
    name: input.name,
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.status === undefined ? {} : { status: input.status }),
  }
  return toApiResult(
    api.client.post('/roles', {
      body,
      schema: iamRoleSchema,
      ...options,
    }),
  )
}

export function getIamRole(roleId: string, options?: ApiRequestOptions) {
  return toApiResult(
    api.client.get('/roles/{roleId}', {
      pathParams: { roleId },
      schema: iamRoleSchema,
      ...options,
    }),
  )
}

export function updateIamRole(roleId: string, input: UpdateIamRole, options?: ApiRequestOptions) {
  const body = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.status === undefined ? {} : { status: input.status }),
  }
  return toApiResult(
    api.client.patch('/roles/{roleId}', {
      pathParams: { roleId },
      body,
      schema: iamRoleSchema,
      ...options,
    }),
  )
}

export function deleteIamRole(roleId: string, options?: ApiRequestOptions) {
  return toApiResult(
    api.client.delete('/roles/{roleId}', {
      pathParams: { roleId },
      schema: iamRoleRefSchema,
      ...options,
    }),
  )
}

export function listIamPermissionCatalog(
  options?: ApiRequestOptions,
): Promise<ApiResult<PermissionCatalog>> {
  return toApiResult(
    api.client.get('/permissions', {
      schema: permissionCatalogSchema,
      ...options,
    }),
  )
}

export function listIamRolePermissions(
  roleId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<RolePermissionList>> {
  return toApiResult(
    api.client.get('/roles/{roleId}/permissions', {
      pathParams: { roleId },
      schema: rolePermissionListSchema,
      ...options,
    }),
  )
}

export function replaceIamRolePermissions(
  roleId: string,
  input: ReplaceRolePermissions,
  options?: ApiRequestOptions,
): Promise<ApiResult<RolePermissionList>> {
  return toApiResult(
    api.client.put('/roles/{roleId}/permissions', {
      pathParams: { roleId },
      body: {
        permissions: input.permissions.map((grant) => ({
          permissionCode: grant.permissionCode,
          scopeType: grant.scopeType,
          ...(grant.organizationIds === undefined || grant.organizationIds.length === 0
            ? {}
            : { organizationIds: grant.organizationIds }),
        })),
      },
      schema: rolePermissionListSchema,
      ...options,
    }),
  )
}

export function listIamUsers(options?: ApiRequestOptions) {
  return toApiResult(
    api.client.get('/users', {
      schema: managedUserListSchema,
      ...options,
    }),
  )
}

export function createIamUser(input: CreateManagedUser, options?: ApiRequestOptions) {
  const body = {
    username: input.username,
    displayName: input.displayName,
    password: input.password,
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    ...(input.roleIds === undefined ? {} : { roleIds: input.roleIds }),
  }
  return toApiResult(
    api.client.post('/users', {
      body,
      schema: managedUserSchema,
      ...options,
    }),
  )
}

export function getIamUser(userId: string, options?: ApiRequestOptions) {
  return toApiResult(
    api.client.get('/users/{userId}', {
      pathParams: { userId },
      schema: managedUserSchema,
      ...options,
    }),
  )
}

export function updateIamUser(
  userId: string,
  input: UpdateManagedUser,
  options?: ApiRequestOptions,
) {
  const body = {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    ...(input.status === undefined ? {} : { status: input.status }),
  }
  return toApiResult(
    api.client.patch('/users/{userId}', {
      pathParams: { userId },
      body,
      schema: managedUserSchema,
      ...options,
    }),
  )
}

export function resetIamUserPassword(
  userId: string,
  input: ResetManagedUserPassword,
  options?: ApiRequestOptions,
): Promise<ApiResult<void>> {
  return toApiResult(
    api.client.post('/users/{userId}/password', {
      pathParams: { userId },
      body: input,
      ...options,
    }),
  )
}

export function listIamUserRoles(
  userId: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<UserRoleList>> {
  return toApiResult(
    api.client.get('/users/{userId}/roles', {
      pathParams: { userId },
      schema: userRoleListSchema,
      ...options,
    }),
  )
}

export function replaceIamUserRoles(
  userId: string,
  input: ReplaceUserRoles,
  options?: ApiRequestOptions,
): Promise<ApiResult<UserRoleList>> {
  return toApiResult(
    api.client.put('/users/{userId}/roles', {
      pathParams: { userId },
      body: input,
      schema: userRoleListSchema,
      ...options,
    }),
  )
}
