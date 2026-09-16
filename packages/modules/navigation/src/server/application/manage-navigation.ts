import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import {
  isContainer,
  type NavigationConfiguration,
  type NavigationVersion,
  type PublishNavigation,
  type SaveDraft,
  type SaveRoleGrants,
} from '../../shared/index.js'
import { createDefaultConfiguration } from './default-configuration.js'
import type { NavigationStore, NavigationUnitOfWork } from './navigation-store.js'
import { validateNavigation } from './validate-navigation.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Application owns authorization, transaction boundaries, validation and publish-pointer concurrency. */
export class ManageNavigation {
  constructor(
    private readonly store: NavigationStore,
    private readonly work: NavigationUnitOfWork,
    private readonly registry: ModuleRegistry,
    private readonly access: IamAccess,
  ) {}

  private authorize(context: AuthContext, action: 'view' | 'manage' | 'publish') {
    return this.access.requireUnscopedPermission(context, 'navigation.' + action, 'navigation.core')
  }
  async list(context: AuthContext) {
    await this.authorize(context, 'view')
    return this.store.list(context.tenantId)
  }
  async catalog(context: AuthContext) {
    await this.authorize(context, 'view')
    return {
      routes: this.registry.routes().map((route) => ({
        key: route.key,
        layout: route.layout,
        allowedLayouts: [...(route.allowedLayouts ?? [route.layout])],
        allowedAccessModes: [...route.allowedAccessModes],
      })),
      roles: await this.access.roles(context.tenantId),
    }
  }
  async version(context: AuthContext, id: string) {
    await this.authorize(context, 'view')
    return this.requiredVersion(this.store, context, id)
  }
  async createDraft(context: AuthContext, sourceId: string | null) {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const root = await tx.store.ensureRoot(context)
      const source = sourceId ?? root.publishedVersionId
      const config =
        source === null
          ? createDefaultConfiguration(this.registry)
          : await this.requiredVersion(tx.store, context, source)
      this.assertValid(config)
      const version: NavigationVersion = {
        ...cloneNodes(config),
        id: newEntityId(),
        revision: await tx.store.nextRevision(context.tenantId),
        editRevision: 0,
        status: 'DRAFT',
        publishedAt: null,
      }
      await tx.store.insertVersion(context, root.id, version)
      await tx.record(context, 'draft_created', version.id, null, {
        revision: version.revision,
        sourceId: source,
      })
      return version
    })
  }
  /** Full replacement, not a patch. Successful saves remap snapshot-local IDs; callers must use the returned DTO. */
  async save(context: AuthContext, id: string, input: SaveDraft) {
    await this.authorize(context, 'manage')
    this.assertValid(input)
    return this.work.run(async (tx) => {
      await tx.store.root(context.tenantId, true)
      const version = await this.requiredVersion(tx.store, context, id)
      if (version.status !== 'DRAFT') fail('NAVIGATION_VERSION_IMMUTABLE', '已发布版本不能编辑')
      if (version.editRevision !== input.expectedEditRevision)
        fail('NAVIGATION_EDIT_CONFLICT', '草稿已被其他人修改，请重新加载')
      const config = cloneNodes(input)
      await tx.store.saveDraft(context, id, config, version.editRevision + 1)
      await tx.record(
        context,
        'draft_saved',
        id,
        { editRevision: version.editRevision },
        {
          editRevision: version.editRevision + 1,
          nodeCodes: config.nodes.map((node) => node.code),
        },
      )
      return this.requiredVersion(tx.store, context, id)
    })
  }
  /** Validate persisted data against today's Edition; this neither saves browser edits nor publishes. */
  async validate(context: AuthContext, id: string) {
    await this.authorize(context, 'view')
    const version = await this.requiredVersion(this.store, context, id)
    return { issues: validateNavigation(version, this.registry) }
  }
  /**
   * Compare-and-switch the tenant's published pointer under its root lock.
   * Rollback selects an immutable historical snapshot; role grants intentionally remain unchanged.
   */
  async publish(context: AuthContext, id: string, input: PublishNavigation, rollback = false) {
    await this.authorize(context, 'publish')
    return this.work.run(async (tx) => {
      const root = await tx.store.root(context.tenantId, true)
      if (root === null) fail('NAVIGATION_NOT_FOUND', '导航不存在', 404)
      if (root.publishedVersionId !== input.expectedPublishedVersionId)
        fail('NAVIGATION_PUBLISH_CONFLICT', '发布指针已经变化，请重新加载')
      const version = await this.requiredVersion(tx.store, context, id)
      if (version.editRevision !== input.expectedEditRevision)
        fail('NAVIGATION_EDIT_CONFLICT', '版本已变化，请重新加载')
      if (rollback ? version.status !== 'PUBLISHED' : version.status !== 'DRAFT') {
        fail('NAVIGATION_VERSION_STATE', rollback ? '仅能回滚到曾发布的版本' : '仅能发布草稿')
      }
      this.assertValid(version)
      if (!rollback) await tx.store.markPublished(context, id)
      await tx.store.pointPublished(context, root.id, id)
      await tx.record(
        context,
        rollback ? 'rolled_back' : 'published',
        root.id,
        { versionId: root.publishedVersionId },
        { versionId: id, revision: version.revision },
      )
      return this.requiredVersion(tx.store, context, id)
    })
  }
  /** Delete an unpublished draft under the root lock; published snapshots are never removable. */
  async deleteDraft(context: AuthContext, id: string) {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      await tx.store.root(context.tenantId, true)
      const version = await this.requiredVersion(tx.store, context, id)
      if (version.status !== 'DRAFT') fail('NAVIGATION_VERSION_STATE', '仅能删除未发布的草稿版本')
      await tx.store.deleteDraft(context, id)
      await tx.record(context, 'draft_deleted', id, { revision: version.revision }, null)
      return { id }
    })
  }
  async roleCodes(context: AuthContext, roleId: string) {
    await this.authorize(context, 'view')
    await this.assertRole(context, roleId)
    return { codes: await this.store.roleCodes(context.tenantId, roleId) }
  }
  /** Replace the complete grant set, guarded by both functional permissions and the previously read code set. */
  async grantRole(context: AuthContext, roleId: string, input: SaveRoleGrants) {
    await this.authorize(context, 'manage')
    await this.access.requireUnscopedPermission(context, 'iam.role.manage', 'iam.authorization')
    await this.assertRole(context, roleId)
    return this.work.run(async (tx) => {
      const root = await tx.store.root(context.tenantId, true)
      if (root?.publishedVersionId === null || root === null)
        fail('NAVIGATION_NOT_PUBLISHED', '请先发布导航', 422)
      const current = await tx.store.roleCodes(context.tenantId, roleId)
      if (JSON.stringify(current) !== JSON.stringify([...new Set(input.expectedCodes)].sort())) {
        fail('NAVIGATION_GRANT_CONFLICT', '角色导航授权已变化，请重新加载')
      }
      const version = await this.requiredVersion(tx.store, context, root.publishedVersionId)
      const assignable = new Set(
        version.nodes
          .filter((node) => !isContainer(node) && node.accessMode === 'PERMISSION')
          .map((node) => node.code),
      )
      const codes = [...new Set(input.codes)].sort()
      if (codes.some((code) => !assignable.has(code)))
        fail('NAVIGATION_GRANT_INVALID', '只能授权当前发布版本的 PERMISSION 节点 code', 422)
      await tx.store.replaceRoleCodes(context, roleId, codes)
      await tx.record(context, 'role_granted', roleId, { codes: current }, { codes })
      return { codes }
    })
  }
  private async assertRole(context: AuthContext, roleId: string) {
    if (!(await this.access.roles(context.tenantId)).some((role) => role.id === roleId)) {
      fail('ROLE_NOT_FOUND', '当前租户中不存在此活跃角色', 404)
    }
  }
  private async requiredVersion(store: NavigationStore, context: AuthContext, id: string) {
    const version = await store.version(context.tenantId, id)
    if (version === null) fail('NAVIGATION_VERSION_NOT_FOUND', '导航版本不存在', 404)
    return version
  }
  private assertValid(config: NavigationConfiguration) {
    const issues = validateNavigation(config, this.registry)
    if (issues.length > 0)
      throw new ApplicationError({
        code: 'NAVIGATION_VALIDATION_FAILED',
        message: '导航配置校验失败',
        status: 422,
        details: { issues },
      })
  }
}

/** Version node IDs are not authorization identities. Remapping also prevents caller-chosen ID collisions. */
function cloneNodes(config: NavigationConfiguration): NavigationConfiguration {
  const ids = new Map(config.nodes.map((node) => [node.id, newEntityId()]))
  return {
    authEntryCode: config.authEntryCode,
    homeCode: config.homeCode,
    nodes: config.nodes.map((node) => {
      const id = ids.get(node.id)
      if (id === undefined) throw new Error('Node clone invariant')
      return {
        ...node,
        id,
        parentId: node.parentId === null ? null : (ids.get(node.parentId) ?? null),
      }
    }),
  }
}
