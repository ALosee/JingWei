import { ApiClientError, createModuleApiClient, executeApiRequest } from '@jingwei/api-client'

import {
  adminNavigationSchema,
  catalogSchema,
  navigationResponseSchema,
  roleGrantsSchema,
  validationResultSchema,
  versionSchema,
  type PublishNavigation,
  type SaveDraft,
  type SaveRoleGrants,
} from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/navigation'>('/api/v1/navigation')

export function getNavigationBootstrap(tenantCode?: string) {
  return executeApiRequest(() =>
    api.throwingClient.get('/bootstrap', {
      ...(tenantCode === undefined ? {} : { query: { tenantCode } }),
      schema: navigationResponseSchema,
    }),
  )
}

export function getMyNavigation() {
  return executeApiRequest(() =>
    api.throwingClient.get('/me', { schema: navigationResponseSchema }),
  )
}

export async function getAuthenticatedNavigation() {
  try {
    return await getMyNavigation()
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null
    throw error
  }
}

export const getNavigationAdmin = () =>
  executeApiRequest(() => api.throwingClient.get('/admin', { schema: adminNavigationSchema }))

export const getNavigationCatalog = () =>
  executeApiRequest(() => api.throwingClient.get('/catalog', { schema: catalogSchema }))

export const getNavigationVersion = (id: string) =>
  executeApiRequest(() =>
    api.throwingClient.get('/versions/{id}', {
      pathParams: { id },
      schema: versionSchema,
    }),
  )

export const createNavigationDraft = (sourceVersionId: string | null) =>
  executeApiRequest(() =>
    api.throwingClient.post('/drafts', {
      body: { sourceVersionId },
      schema: versionSchema,
    }),
  )

export const saveNavigationDraft = (id: string, input: SaveDraft) =>
  executeApiRequest(() =>
    api.throwingClient.put('/versions/{id}', {
      pathParams: { id },
      body: input,
      schema: versionSchema,
    }),
  )

export const validateNavigationVersion = (id: string) =>
  executeApiRequest(() =>
    api.throwingClient.post('/versions/{id}/validate', {
      pathParams: { id },
      schema: validationResultSchema,
    }),
  )

export const publishNavigationVersion = (id: string, input: PublishNavigation, rollback = false) =>
  rollback
    ? executeApiRequest(() =>
        api.throwingClient.post('/versions/{id}/rollback', {
          pathParams: { id },
          body: input,
          schema: versionSchema,
        }),
      )
    : executeApiRequest(() =>
        api.throwingClient.post('/versions/{id}/publish', {
          pathParams: { id },
          body: input,
          schema: versionSchema,
        }),
      )

export const getRoleNavigation = (roleId: string) =>
  executeApiRequest(() =>
    api.throwingClient.get('/roles/{roleId}/grants', {
      pathParams: { roleId },
      schema: roleGrantsSchema,
    }),
  )

export const saveRoleNavigation = (roleId: string, input: SaveRoleGrants) =>
  executeApiRequest(() =>
    api.throwingClient.put('/roles/{roleId}/grants', {
      pathParams: { roleId },
      body: input,
      schema: roleGrantsSchema,
    }),
  )
