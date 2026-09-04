import { ApplicationError, type AuthContext, type TenantId } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { isContainer, type NavigationNode, type NavigationResponse } from '../../shared/index.js'
import type { NavigationSource } from '../domain/navigation.js'
import { validateNavigation } from './validate-navigation.js'

/** Role grants refer to node.code, never routeKey. Containers inherit visibility, not authority. */
export function projectNodes(
  nodes: readonly NavigationNode[],
  authenticated: boolean,
  codes: ReadonlySet<string>,
): NavigationNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const enabled = (node: NavigationNode) => {
    let current: NavigationNode | undefined = node
    const seen = new Set<string>()
    while (current !== undefined) {
      if (current.status !== 'ENABLED' || seen.has(current.id)) return false
      seen.add(current.id)
      current = current.parentId === null ? undefined : byId.get(current.parentId)
    }
    return true
  }
  const allowed = nodes.filter(
    (node) =>
      !isContainer(node) &&
      enabled(node) &&
      (node.accessMode === 'PUBLIC' ||
        (authenticated &&
          (node.accessMode === 'AUTHENTICATED' ||
            (node.accessMode === 'PERMISSION' && codes.has(node.code))))),
  )
  const kept = new Set(allowed.map((node) => node.id))
  // Hidden pages alone do not create empty menu containers.
  for (const node of allowed.filter((item) => item.type !== 'PAGE')) {
    let parent = node.parentId === null ? undefined : byId.get(node.parentId)
    while (parent !== undefined) {
      if (isContainer(parent)) kept.add(parent.id)
      parent = parent.parentId === null ? undefined : byId.get(parent.parentId)
    }
  }
  return nodes
    .filter((node) => kept.has(node.id))
    .map((node) => {
      let parentId = node.parentId
      while (parentId !== null && !kept.has(parentId))
        parentId = byId.get(parentId)?.parentId ?? null
      return { ...node, parentId }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}

export class ResolveNavigation {
  constructor(
    private readonly source: NavigationSource,
    private readonly registry: ModuleRegistry,
    private readonly access: IamAccess,
  ) {}

  /** The HTTP boundary resolves a real tenant first; anonymous output never includes role-specific nodes. */
  bootstrap(tenantId: TenantId): Promise<NavigationResponse> {
    return this.resolve(tenantId, null)
  }
  /** Reads live role grants on every call. AuthContext.roleIds is not an authorization cache. */
  forUser(context: AuthContext): Promise<NavigationResponse> {
    return this.resolve(context.tenantId, context)
  }

  private async resolve(
    tenantId: TenantId,
    context: AuthContext | null,
  ): Promise<NavigationResponse> {
    const version = await this.source.loadPublished(tenantId)
    if (version === null)
      throw new ApplicationError({
        code: 'NAVIGATION_NOT_PUBLISHED',
        message: '当前租户尚未发布导航',
        status: 503,
      })
    if (validateNavigation(version, this.registry).length > 0) {
      throw new ApplicationError({
        code: 'NAVIGATION_CONFIGURATION_INVALID',
        message: '已发布导航与当前 Edition 不兼容，请联系管理员',
        status: 503,
      })
    }
    const roleIds = context === null ? [] : await this.access.activeRoleIds(context)
    const codes = await this.source.grantedCodes(tenantId, roleIds)
    const nodes = projectNodes(version.nodes, context !== null, codes)
    return {
      schemaVersion: 2,
      versionId: version.id,
      publishedRevision: version.revision,
      authEntryCode: version.authEntryCode,
      homeCode: nodes.some((node) => node.code === version.homeCode) ? version.homeCode : null,
      nodes,
    }
  }
}
