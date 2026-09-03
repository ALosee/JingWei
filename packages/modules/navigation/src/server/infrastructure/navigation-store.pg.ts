import type { Kysely } from 'kysely'
import { PostgresAuditWriter } from '@jingwei/audit'
import { PostgresOutboxAppender } from '@jingwei/outbox'
import { newEntityId, type ApplicationContext, type TenantId } from '@jingwei/kernel'
import { versionSchema, type NavigationConfiguration, type NavigationNode, type NavigationVersion } from '../../shared/index.js'
import type { NavigationStore, NavigationUnitOfWork, NavigationTransaction } from '../application/navigation-store.js'

interface RootRow {
  id: string; tenant_id: string; code: string; name: string; kind: string; published_version_id: string | null
  created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null
}
interface VersionRow {
  id: string; tenant_id: string; navigation_id: string; version: number; status: 'DRAFT' | 'PUBLISHED'
  published_at: Date | null; created_at: Date; created_by: string | null; published_by: string | null
  auth_entry_code: string; home_code: string | null; edit_revision: number
}
interface NodeRow {
  id: string; tenant_id: string; version_id: string; code: string; name: string; parent_id: string | null
  type: NavigationNode['type']; status: NavigationNode['status']; route_key: string | null; path: string | null
  layout: NavigationNode['layout']; icon: string | null; sort_order: number; access_mode: NavigationNode['accessMode']
  href: string | null; external_target: NavigationNode['externalTarget']; params: unknown; query: unknown
}
interface RoleGrantRow { tenant_id: string; role_id: string; navigation_code: string; created_at: Date; created_by: string }
export interface NavigationDatabase {
  'navigation.navigation': RootRow
  'navigation.navigation_version': VersionRow
  'navigation.navigation_node': NodeRow
  'navigation.role_navigation': RoleGrantRow
}

export class PostgresNavigationStore implements NavigationStore {
  constructor(private readonly db: Kysely<NavigationDatabase>) {}
  async root(tenantId: TenantId, lock = false) {
    let query = this.db.selectFrom('navigation.navigation').select(['id', 'published_version_id'])
      .where('tenant_id', '=', tenantId).where('code', '=', 'main')
    if (lock) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    return row === undefined ? null : { id: row.id, publishedVersionId: row.published_version_id }
  }
  async ensureRoot(context: ApplicationContext) {
    const now = new Date()
    await this.db.insertInto('navigation.navigation').values({
      id: newEntityId(), tenant_id: context.tenantId, code: 'main', name: '主导航', kind: 'WEB',
      published_version_id: null, created_at: now, created_by: context.userId, updated_at: now, updated_by: context.userId,
    }).onConflict((conflict) => conflict.columns(['tenant_id', 'code']).doNothing()).execute()
    const root = await this.root(context.tenantId, true)
    if (root === null) throw new Error('Navigation root creation failed')
    return root
  }
  async list(tenantId: TenantId) {
    const root = await this.root(tenantId)
    if (root === null) return { publishedVersionId: null, versions: [] }
    const rows = await this.db.selectFrom('navigation.navigation_version').selectAll()
      .where('tenant_id', '=', tenantId).where('navigation_id', '=', root.id).orderBy('version', 'desc').execute()
    return { publishedVersionId: root.publishedVersionId, versions: rows.map((row) => ({
      id: row.id, revision: row.version, editRevision: row.edit_revision, status: row.status,
      publishedAt: row.published_at?.toISOString() ?? null, authEntryCode: row.auth_entry_code, homeCode: row.home_code,
    })) }
  }
  async version(tenantId: TenantId, id: string): Promise<NavigationVersion | null> {
    const row = await this.db.selectFrom('navigation.navigation_version').selectAll()
      .where('tenant_id', '=', tenantId).where('id', '=', id).executeTakeFirst()
    if (row === undefined) return null
    const nodes = await this.db.selectFrom('navigation.navigation_node').selectAll()
      .where('tenant_id', '=', tenantId).where('version_id', '=', id).orderBy('sort_order').orderBy('code').execute()
    return versionSchema.parse({
      id: row.id, revision: row.version, editRevision: row.edit_revision, status: row.status,
      publishedAt: row.published_at?.toISOString() ?? null, authEntryCode: row.auth_entry_code, homeCode: row.home_code,
      nodes: nodes.map((n) => ({ id: n.id, code: n.code, name: n.name, parentId: n.parent_id, type: n.type,
        status: n.status, routeKey: n.route_key, path: n.path, layout: n.layout, icon: n.icon,
        sortOrder: n.sort_order, accessMode: n.access_mode, href: n.href, externalTarget: n.external_target,
        params: n.params, query: n.query })),
    })
  }
  async loadPublished(tenantId: TenantId) {
    const root = await this.root(tenantId)
    return root?.publishedVersionId ? this.version(tenantId, root.publishedVersionId) : null
  }
  async nextRevision(tenantId: TenantId) {
    const result = await this.db.selectFrom('navigation.navigation_version')
      .select((eb) => eb.fn.max('version').as('maximum')).where('tenant_id', '=', tenantId).executeTakeFirst()
    return (result?.maximum ?? 0) + 1
  }
  async insertVersion(context: ApplicationContext, rootId: string, version: NavigationVersion) {
    await this.db.insertInto('navigation.navigation_version').values({
      id: version.id, tenant_id: context.tenantId, navigation_id: rootId, version: version.revision,
      status: 'DRAFT', published_at: null, created_at: new Date(), created_by: context.userId,
      published_by: null, auth_entry_code: version.authEntryCode, home_code: version.homeCode, edit_revision: 0,
    }).execute()
    await this.insertNodes(context.tenantId, version.id, version.nodes)
  }
  async saveDraft(context: ApplicationContext, id: string, config: NavigationConfiguration, editRevision: number) {
    await this.db.deleteFrom('navigation.navigation_node').where('tenant_id', '=', context.tenantId).where('version_id', '=', id).execute()
    await this.insertNodes(context.tenantId, id, config.nodes)
    await this.db.updateTable('navigation.navigation_version').set({
      auth_entry_code: config.authEntryCode, home_code: config.homeCode, edit_revision: editRevision,
    }).where('tenant_id', '=', context.tenantId).where('id', '=', id).where('status', '=', 'DRAFT').execute()
  }
  private async insertNodes(tenantId: TenantId, versionId: string, nodes: readonly NavigationNode[]) {
    if (nodes.length === 0) return
    await this.db.insertInto('navigation.navigation_node').values(nodes.map((n) => ({
      id: n.id, tenant_id: tenantId, version_id: versionId, code: n.code, name: n.name, type: n.type, status: n.status,
      parent_id: n.parentId, route_key: n.routeKey, path: n.path, layout: n.layout, icon: n.icon, sort_order: n.sortOrder,
      access_mode: n.accessMode, href: n.href, external_target: n.externalTarget,
      params: JSON.stringify(n.params), query: JSON.stringify(n.query),
    }))).execute()
  }
  async markPublished(context: ApplicationContext, id: string) {
    await this.db.updateTable('navigation.navigation_version').set({
      status: 'PUBLISHED', published_at: new Date(), published_by: context.userId,
    }).where('tenant_id', '=', context.tenantId).where('id', '=', id).where('status', '=', 'DRAFT').execute()
  }
  async pointPublished(context: ApplicationContext, rootId: string, versionId: string) {
    await this.db.updateTable('navigation.navigation').set({
      published_version_id: versionId, updated_at: new Date(), updated_by: context.userId,
    }).where('tenant_id', '=', context.tenantId).where('id', '=', rootId).execute()
  }
  async grantedCodes(tenantId: TenantId, roleIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (roleIds.length === 0) return new Set()
    const rows = await this.db.selectFrom('navigation.role_navigation').select('navigation_code')
      .where('tenant_id', '=', tenantId).where('role_id', 'in', [...roleIds]).execute()
    return new Set(rows.map((row) => row.navigation_code))
  }
  async roleCodes(tenantId: TenantId, roleId: string) {
    const rows = await this.db.selectFrom('navigation.role_navigation').select('navigation_code')
      .where('tenant_id', '=', tenantId).where('role_id', '=', roleId).orderBy('navigation_code').execute()
    return rows.map((row) => row.navigation_code)
  }
  async replaceRoleCodes(context: ApplicationContext, roleId: string, codes: readonly string[]) {
    await this.db.deleteFrom('navigation.role_navigation')
      .where('tenant_id', '=', context.tenantId).where('role_id', '=', roleId).execute()
    if (codes.length > 0) await this.db.insertInto('navigation.role_navigation').values(codes.map((code) => ({
      tenant_id: context.tenantId, role_id: roleId, navigation_code: code, created_at: new Date(), created_by: context.userId,
    }))).execute()
  }
}

export class PostgresNavigationUnitOfWork implements NavigationUnitOfWork {
  constructor(private readonly db: Kysely<NavigationDatabase>) {}
  run<T>(work: (transaction: NavigationTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) => work({
      store: new PostgresNavigationStore(transaction),
      record: async (context, action, entityId, before, after) => {
        await new PostgresAuditWriter(transaction).append({
          context, module: 'navigation', action, entityType: 'navigation', entityId, result: 'SUCCESS', before, after,
        })
        await new PostgresOutboxAppender().append(transaction, {
          tenantId: context.tenantId, type: 'navigation.' + action, version: 1,
          aggregateType: 'navigation', aggregateId: entityId, occurredAt: new Date(),
          payload: { requestId: context.requestId, actorUserId: context.userId, after },
        })
      },
    }))
  }
}
