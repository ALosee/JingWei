import { ApiClientError, requestJson } from '@jingwei/api-client'
import { csrfCookieName, csrfHeaderName } from '@jingwei/auth/shared'
import type { z } from 'zod'
import { adminNavigationSchema, catalogSchema, navigationResponseSchema, roleGrantsSchema,
  validationResultSchema, versionSchema, type PublishNavigation, type SaveDraft, type SaveRoleGrants } from '../shared/index.js'

export function getNavigationBootstrap(tenantCode?: string) {
  return requestJson({ input: '/api/v1/navigation/bootstrap' + (tenantCode ? '?tenantCode=' + encodeURIComponent(tenantCode) : ''), schema: navigationResponseSchema })
}
export function getMyNavigation() {
  return requestJson({ input: '/api/v1/navigation/me', schema: navigationResponseSchema })
}
export async function getAuthenticatedNavigation() {
  try { return await getMyNavigation() }
  catch (error) { if (error instanceof ApiClientError && error.status === 401) return null; throw error }
}
function mutation<T extends z.ZodType>(path: string, method: string, body: unknown, schema: T) {
  const cookie = document.cookie.split('; ').find((item) => item.startsWith(csrfCookieName + '='))
  const token = cookie?.slice(csrfCookieName.length + 1) ?? ''
  return requestJson({ input: '/api/v1/navigation' + path, schema,
    init: { method, headers: { 'content-type': 'application/json', [csrfHeaderName]: decodeURIComponent(token) }, body: JSON.stringify(body) } })
}
export const getNavigationAdmin = () => requestJson({ input: '/api/v1/navigation/admin', schema: adminNavigationSchema })
export const getNavigationCatalog = () => requestJson({ input: '/api/v1/navigation/catalog', schema: catalogSchema })
export const getNavigationVersion = (id: string) => requestJson({ input: '/api/v1/navigation/versions/' + encodeURIComponent(id), schema: versionSchema })
export const createNavigationDraft = (sourceVersionId: string | null) => mutation('/drafts', 'POST', { sourceVersionId }, versionSchema)
export const saveNavigationDraft = (id: string, input: SaveDraft) => mutation('/versions/' + encodeURIComponent(id), 'PUT', input, versionSchema)
export const validateNavigationVersion = (id: string) => mutation('/versions/' + encodeURIComponent(id) + '/validate', 'POST', {}, validationResultSchema)
export const publishNavigationVersion = (id: string, input: PublishNavigation, rollback = false) =>
  mutation('/versions/' + encodeURIComponent(id) + (rollback ? '/rollback' : '/publish'), 'POST', input, versionSchema)
export const getRoleNavigation = (roleId: string) => requestJson({
  input: '/api/v1/navigation/roles/' + encodeURIComponent(roleId) + '/grants', schema: roleGrantsSchema,
})
export const saveRoleNavigation = (roleId: string, input: SaveRoleGrants) =>
  mutation('/roles/' + encodeURIComponent(roleId) + '/grants', 'PUT', input, roleGrantsSchema)
