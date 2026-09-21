import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  AdminNavigation,
  NavigationConfiguration,
  NavigationVersion,
} from '../../shared/index.js'
import type { NavigationSource } from '../domain/navigation.js'

export type NavigationWriteContext = Pick<ApplicationContext, 'tenantId' | 'userId'>

export interface NavigationRoot {
  id: string
  publishedVersionId: string | null
}
export interface NavigationStore extends NavigationSource {
  root(tenantId: TenantId, lock?: boolean): Promise<NavigationRoot | null>
  ensureRoot(context: NavigationWriteContext): Promise<NavigationRoot>
  list(tenantId: TenantId): Promise<AdminNavigation>
  version(tenantId: TenantId, id: string): Promise<NavigationVersion | null>
  nextRevision(tenantId: TenantId): Promise<number>
  insertVersion(
    context: NavigationWriteContext,
    rootId: string,
    version: NavigationVersion,
  ): Promise<void>
  saveDraft(
    context: NavigationWriteContext,
    id: string,
    config: NavigationConfiguration,
    editRevision: number,
  ): Promise<void>
  markPublished(context: NavigationWriteContext, id: string): Promise<void>
  pointPublished(context: NavigationWriteContext, rootId: string, versionId: string): Promise<void>
  deleteDraft(context: NavigationWriteContext, id: string): Promise<void>
  roleCodes(tenantId: TenantId, roleId: string): Promise<string[]>
  replaceRoleCodes(
    context: NavigationWriteContext,
    roleId: string,
    codes: readonly string[],
  ): Promise<void>
}
export interface NavigationTransaction {
  store: NavigationStore
  record(
    context: ApplicationContext,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}
/** Application chooses transaction scope; infrastructure supplies a transaction-bound executor. */
export interface NavigationUnitOfWork {
  run<T>(work: (transaction: NavigationTransaction) => Promise<T>): Promise<T>
}
