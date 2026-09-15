import { z } from 'zod'

export const navigationNodeTypes = ['DIRECTORY', 'GROUP', 'MENU', 'PAGE', 'EXTERNAL_LINK'] as const
export const navigationAccessModes = ['PUBLIC', 'AUTHENTICATED', 'PERMISSION'] as const
export const codeSchema = z.string().regex(/^[a-z][a-z0-9._-]{0,119}$/u)
const parameterKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/u)
const scalar = z.union([z.string().max(2_000), z.number(), z.boolean()])
export const paramsSchema = z.record(parameterKey, z.union([z.string().max(500), z.number()]))
export const querySchema = z.record(
  parameterKey,
  z.union([scalar, z.null(), z.array(scalar).max(50)]),
)

/** Configuration DTO, never a database row. PAGE is routable but absent from the menu projection. */
export const navigationNodeSchema = z
  .object({
    id: z.uuid(),
    code: codeSchema,
    name: z.string().trim().min(1).max(200),
    parentId: z.uuid().nullable(),
    type: z.enum(navigationNodeTypes),
    status: z.enum(['ENABLED', 'DISABLED']),
    routeKey: z.string().max(160).nullable(),
    path: z.string().max(500).nullable(),
    layout: z.enum(['base', 'blank']).nullable(),
    icon: z.string().max(160).nullable(),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    accessMode: z.enum(navigationAccessModes).nullable(),
    href: z.string().max(2048).nullable(),
    externalTarget: z.enum(['SELF', 'BLANK']).nullable(),
    params: paramsSchema,
    query: querySchema,
  })
  .strict()
  .meta({ id: 'NavigationNode' })

export const configurationSchema = z
  .object({
    authEntryCode: codeSchema,
    homeCode: codeSchema.nullable(),
    nodes: z.array(navigationNodeSchema).max(1_000),
  })
  .strict()
  .meta({ id: 'NavigationConfiguration' })

export const versionSchema = configurationSchema
  .extend({
    id: z.uuid(),
    revision: z.number().int().positive(),
    editRevision: z.number().int().nonnegative(),
    status: z.enum(['DRAFT', 'PUBLISHED']),
    publishedAt: z.string().nullable(),
  })
  .meta({ id: 'NavigationVersion' })
export const navigationResponseSchema = z
  .object({
    schemaVersion: z.literal(2),
    versionId: z.uuid(),
    publishedRevision: z.number().int().positive(),
    authEntryCode: codeSchema,
    homeCode: codeSchema.nullable(),
    nodes: z.array(navigationNodeSchema),
  })
  .meta({ id: 'NavigationResponse' })
export const adminNavigationSchema = z
  .object({
    publishedVersionId: z.uuid().nullable(),
    versions: z.array(versionSchema.omit({ nodes: true })),
  })
  .meta({ id: 'NavigationAdminOverview' })
export const saveDraftSchema = configurationSchema
  .extend({
    expectedEditRevision: z.number().int().nonnegative(),
  })
  .meta({ id: 'NavigationSaveDraftInput' })
export const publishSchema = z
  .object({
    expectedEditRevision: z.number().int().nonnegative(),
    expectedPublishedVersionId: z.uuid().nullable(),
  })
  .strict()
  .meta({ id: 'NavigationPublishInput' })
export const roleGrantsSchema = z
  .object({
    codes: z.array(codeSchema).max(1_000),
  })
  .strict()
  .meta({ id: 'NavigationRoleGrants' })
export const saveRoleGrantsSchema = roleGrantsSchema
  .extend({
    expectedCodes: z.array(codeSchema).max(1_000),
  })
  .meta({ id: 'NavigationSaveRoleGrantsInput' })
export const validationResultSchema = z
  .object({
    issues: z.array(
      z.object({ code: z.string(), nodeId: z.string().optional(), message: z.string() }),
    ),
  })
  .meta({ id: 'NavigationValidationResult' })
export const catalogSchema = z
  .object({
    routes: z.array(
      z.object({
        key: z.string(),
        layout: z.enum(['base', 'blank']),
        allowedLayouts: z.array(z.enum(['base', 'blank'])),
        allowedAccessModes: z.array(z.enum(navigationAccessModes)),
      }),
    ),
    roles: z.array(z.object({ id: z.uuid(), code: z.string(), name: z.string() })),
  })
  .meta({ id: 'NavigationCatalog' })

export type NavigationNode = z.infer<typeof navigationNodeSchema>
export type NavigationNodeType = NavigationNode['type']
export type NavigationConfiguration = z.infer<typeof configurationSchema>
export type NavigationVersion = z.infer<typeof versionSchema>
export type NavigationResponse = z.infer<typeof navigationResponseSchema>
export type AdminNavigation = z.infer<typeof adminNavigationSchema>
export type NavigationCatalog = z.infer<typeof catalogSchema>
export type SaveDraft = z.infer<typeof saveDraftSchema>
export type PublishNavigation = z.infer<typeof publishSchema>
export type SaveRoleGrants = z.infer<typeof saveRoleGrantsSchema>

export function isContainer(node: NavigationNode): boolean {
  return node.type === 'DIRECTORY' || node.type === 'GROUP'
}
export function isInternal(node: NavigationNode): boolean {
  return node.type === 'MENU' || node.type === 'PAGE'
}

/** Only safe path-template syntax is configurable; no custom regex or executable expressions. */
export function pathParameters(path: string): { name: string; optional: boolean }[] | null {
  if (!path.startsWith('/') || path === '/' || path.endsWith('/') || path.includes('//'))
    return null
  const result: { name: string; optional: boolean }[] = []
  const segments = path.slice(1).split('/')
  for (const [index, segment] of segments.entries()) {
    const parameter = /^:([a-zA-Z][a-zA-Z0-9_]*)(\?)?$/u.exec(segment)
    if (parameter?.[1] !== undefined) {
      const optional = parameter[2] !== undefined
      if (optional && index !== segments.length - 1) return null
      if (result.some(({ name }) => name === parameter[1])) return null
      result.push({ name: parameter[1], optional })
    } else if (!/^[a-zA-Z0-9_~-][a-zA-Z0-9._~-]*$/u.test(segment)) return null
  }
  return result
}

/** Concrete menu/entry URL; runtime PAGE params remain the caller's responsibility. */
export function navigationTarget(node: NavigationNode): string | null {
  if (node.path === null) return null
  const parameters = pathParameters(node.path)
  if (parameters === null) return null
  let path = node.path
  for (const parameter of parameters) {
    const value = node.params[parameter.name]
    // URL parsers normalize dot segments, even when a caller expects them to be opaque IDs.
    if (value === '.' || value === '..') return null
    if ((value === undefined || value === '') && !parameter.optional) return null
    const token = ':' + parameter.name + (parameter.optional ? '?' : '')
    if (value === undefined || value === '') path = path.replace('/' + token, '')
    else path = path.replace(token, encodeURIComponent(String(value)))
  }
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(node.query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null) query.append(key, String(item))
      else query.append(key, '')
    }
  }
  return path + (query.size > 0 ? '?' + query.toString() : '')
}

export function isIconifyName(value: string): boolean {
  return /^[a-z0-9]+:[a-z0-9-]+$/iu.test(value)
}

/** Full iconify name only; short aliases are not supported. */
export function resolveNavigationIcon(icon: string | null, type: NavigationNode['type']): string {
  const raw = (icon ?? '').trim()
  if (raw !== '') return raw
  if (type === 'DIRECTORY') return 'lucide:folder'
  if (type === 'EXTERNAL_LINK') return 'lucide:external-link'
  if (type === 'GROUP') return 'lucide:layers'
  if (type === 'PAGE') return 'lucide:file-text'
  return 'lucide:layout-grid'
}
