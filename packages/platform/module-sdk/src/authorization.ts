export type PermissionEvaluationMode = 'UNSCOPED' | 'SCOPED'

/** Static functional-authorization requirement shared by Application and transport contracts. */
export interface PermissionRequirement {
  readonly permission: string
  readonly capability: string
  readonly scope: PermissionEvaluationMode
}

export type UnscopedPermissionRequirement = PermissionRequirement & { readonly scope: 'UNSCOPED' }
export type ScopedPermissionRequirement = PermissionRequirement & { readonly scope: 'SCOPED' }

/** Preserves literal permission metadata and prevents runtime mutation of the shared policy object. */
export function definePermissionRequirement<const TRequirement extends PermissionRequirement>(
  requirement: TRequirement,
): Readonly<TRequirement> {
  return Object.freeze(requirement)
}
