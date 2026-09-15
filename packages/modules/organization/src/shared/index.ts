import { z } from 'zod'

export const organizationTypes = ['COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER'] as const
export type OrganizationType = (typeof organizationTypes)[number]

export const organizationUnitStatuses = ['ENABLED', 'DISABLED'] as const
export type OrganizationUnitStatus = (typeof organizationUnitStatuses)[number]

export const organizationUnitCodeSchema = z.string().trim().min(1).max(120)
export const organizationUnitNameSchema = z.string().trim().min(1).max(200)

/** Flat unit DTO; callers assemble hierarchy from parentId. Never a database row. */
export const organizationUnitSchema = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    code: organizationUnitCodeSchema,
    name: organizationUnitNameSchema,
    type: z.enum(organizationTypes),
    status: z.enum(organizationUnitStatuses),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'OrganizationUnit' })

export const organizationTreeSchema = z
  .object({
    units: z.array(organizationUnitSchema).max(5_000),
  })
  .meta({ id: 'OrganizationTree' })

export const createOrganizationUnitSchema = z
  .object({
    parentId: z.uuid().nullable(),
    code: organizationUnitCodeSchema,
    name: organizationUnitNameSchema,
    type: z.enum(organizationTypes),
    status: z.enum(organizationUnitStatuses).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  })
  .strict()
  .meta({ id: 'OrganizationCreateUnitInput' })

export const updateOrganizationUnitSchema = z
  .object({
    parentId: z.uuid().nullable().optional(),
    code: organizationUnitCodeSchema.optional(),
    name: organizationUnitNameSchema.optional(),
    type: z.enum(organizationTypes).optional(),
    status: z.enum(organizationUnitStatuses).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  })
  .strict()
  .meta({ id: 'OrganizationUpdateUnitInput' })

export const organizationUnitRefSchema = z
  .object({ id: z.uuid() })
  .strict()
  .meta({ id: 'OrganizationUnitRef' })

export const organizationPositionSchema = z
  .object({
    id: z.uuid(),
    orgUnitId: z.uuid(),
    code: organizationUnitCodeSchema,
    name: organizationUnitNameSchema,
    status: z.enum(organizationUnitStatuses),
    sortOrder: z.number().int().min(-100_000).max(100_000),
  })
  .strict()
  .meta({ id: 'OrganizationPosition' })

export const organizationPositionListSchema = z
  .object({
    positions: z.array(organizationPositionSchema).max(1_000),
  })
  .meta({ id: 'OrganizationPositionList' })

export const createOrganizationPositionSchema = z
  .object({
    code: organizationUnitCodeSchema,
    name: organizationUnitNameSchema,
    status: z.enum(organizationUnitStatuses).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  })
  .strict()
  .meta({ id: 'OrganizationCreatePositionInput' })

export const updateOrganizationPositionSchema = z
  .object({
    code: organizationUnitCodeSchema.optional(),
    name: organizationUnitNameSchema.optional(),
    status: z.enum(organizationUnitStatuses).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  })
  .strict()
  .meta({ id: 'OrganizationUpdatePositionInput' })

export const organizationPositionRefSchema = z
  .object({ id: z.uuid() })
  .strict()
  .meta({ id: 'OrganizationPositionRef' })

export type OrganizationUnit = z.infer<typeof organizationUnitSchema>
export type OrganizationTree = z.infer<typeof organizationTreeSchema>
export type CreateOrganizationUnit = z.infer<typeof createOrganizationUnitSchema>
export type UpdateOrganizationUnit = z.infer<typeof updateOrganizationUnitSchema>
export type OrganizationPosition = z.infer<typeof organizationPositionSchema>
export type CreateOrganizationPosition = z.infer<typeof createOrganizationPositionSchema>
export type UpdateOrganizationPosition = z.infer<typeof updateOrganizationPositionSchema>

export interface OrganizationTreeNode {
  unit: OrganizationUnit
  children: OrganizationTreeNode[]
  depth: number
}

export function compareOrganizationUnits(left: OrganizationUnit, right: OrganizationUnit): number {
  return left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
}

export function buildOrganizationTree(units: readonly OrganizationUnit[]): OrganizationTreeNode[] {
  const byParent = new Map<string | null, OrganizationUnit[]>()
  for (const unit of units) {
    const bucket = byParent.get(unit.parentId)
    if (bucket === undefined) byParent.set(unit.parentId, [unit])
    else bucket.push(unit)
  }
  const build = (parentId: string | null, depth: number): OrganizationTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .toSorted(compareOrganizationUnits)
      .map((unit) => ({ unit, depth, children: build(unit.id, depth + 1) }))
  return build(null, 0)
}

export function collectOrganizationDescendantIds(
  units: readonly OrganizationUnit[],
  rootId: string,
): Set<string> {
  const children = new Map<string, string[]>()
  for (const unit of units) {
    if (unit.parentId === null) continue
    const bucket = children.get(unit.parentId)
    if (bucket === undefined) children.set(unit.parentId, [unit.id])
    else bucket.push(unit.id)
  }
  const result = new Set<string>()
  const stack = [rootId]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) continue
    for (const child of children.get(current) ?? []) {
      if (result.has(child)) continue
      result.add(child)
      stack.push(child)
    }
  }
  return result
}

/** Move target must stay outside the node subtree (including self). */
export function canMoveOrganizationUnit(
  units: readonly OrganizationUnit[],
  unitId: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true
  if (parentId === unitId) return false
  return !collectOrganizationDescendantIds(units, unitId).has(parentId)
}

export function organizationParentOptions(
  units: readonly OrganizationUnit[],
  selectedId: string,
): { id: string | null; label: string; depth: number }[] {
  const tree = buildOrganizationTree(units)
  const options: { id: string | null; label: string; depth: number }[] = [
    { id: null, label: '根组织', depth: 0 },
  ]
  const walk = (nodes: readonly OrganizationTreeNode[]): void => {
    for (const item of nodes) {
      if (canMoveOrganizationUnit(units, selectedId, item.unit.id)) {
        options.push({
          id: item.unit.id,
          label: `${item.unit.name} · ${item.unit.code}`,
          depth: item.depth,
        })
      }
      walk(item.children)
    }
  }
  walk(tree)
  return options
}

/** Creating a new unit: every existing unit is a valid parent (no cycle yet). */
export function organizationCreateParentOptions(
  units: readonly OrganizationUnit[],
): { id: string | null; label: string; depth: number }[] {
  const tree = buildOrganizationTree(units)
  const options: { id: string | null; label: string; depth: number }[] = [
    { id: null, label: '根组织', depth: 0 },
  ]
  const walk = (nodes: readonly OrganizationTreeNode[]): void => {
    for (const item of nodes) {
      options.push({
        id: item.unit.id,
        label: `${item.unit.name} · ${item.unit.code}`,
        depth: item.depth,
      })
      walk(item.children)
    }
  }
  walk(tree)
  return options
}

export function nextOrganizationSortOrder(
  units: readonly OrganizationUnit[],
  parentId: string | null,
): number {
  const siblings = units.filter((unit) => unit.parentId === parentId)
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((unit) => unit.sortOrder)) + 1
}

export function organizationTypeLabel(type: OrganizationType): string {
  switch (type) {
    case 'COMPANY':
      return '公司'
    case 'DIVISION':
      return '事业群'
    case 'DEPARTMENT':
      return '部门'
    case 'TEAM':
      return '团队'
    default:
      return '其他'
  }
}

export function organizationUnitIcon(type: OrganizationType): string {
  switch (type) {
    case 'COMPANY':
      return 'lucide:building-2'
    case 'DIVISION':
      return 'lucide:layers'
    case 'DEPARTMENT':
      return 'lucide:folder'
    case 'TEAM':
      return 'lucide:users'
    default:
      return 'lucide:circle'
  }
}
