import type {
  CustomScopeReferenceDirectory,
  CustomScopeReferenceOption,
} from '@jingwei/module-iam/public/web'

import { listOrganizationalScopeOptions } from '../client/index.js'

function orderForPicker(
  units: readonly Omit<CustomScopeReferenceOption, 'depth'>[],
): CustomScopeReferenceOption[] {
  const availableIds = new Set(units.map(({ id }) => id))
  const byParent = new Map<string | null, Omit<CustomScopeReferenceOption, 'depth'>[]>()
  for (const unit of units) {
    const parentId =
      unit.parentId !== null && availableIds.has(unit.parentId) ? unit.parentId : null
    const normalized = { ...unit, parentId }
    const bucket = byParent.get(parentId)
    if (bucket === undefined) byParent.set(parentId, [normalized])
    else bucket.push(normalized)
  }

  const ordered: CustomScopeReferenceOption[] = []
  const walk = (parentId: string | null, depth: number): void => {
    const children = [...(byParent.get(parentId) ?? [])].toSorted((left, right) =>
      left.code.localeCompare(right.code),
    )
    for (const child of children) {
      ordered.push({ ...child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk(null, 0)
  return ordered
}

/** Organization adapter for IAM's UI-only CUSTOM reference contract. */
export const organizationalScopeReferenceDirectory: CustomScopeReferenceDirectory = {
  async load(options) {
    const result = await listOrganizationalScopeOptions(options)
    if (result.error !== null) throw result.error
    return orderForPicker(
      result.data.units.map(({ id, parentId, code, name }) => ({ id, parentId, code, name })),
    )
  },
}
