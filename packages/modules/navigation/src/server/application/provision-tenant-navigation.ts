import type { PlatformAuditContext } from '@jingwei/audit'
import { ApplicationError, newEntityId, type TenantId, type UserId } from '@jingwei/kernel'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import type { NavigationVersion } from '../../shared/index.js'
import { createDefaultConfiguration } from './default-configuration.js'
import type { NavigationStore } from './navigation-store.js'
import { validateNavigation } from './validate-navigation.js'

export interface TenantNavigationProvisioningTransaction {
  readonly store: NavigationStore
  recordPlatform(
    context: PlatformAuditContext,
    tenantId: TenantId,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface TenantNavigationProvisioningUnitOfWork {
  run<T>(work: (transaction: TenantNavigationProvisioningTransaction) => Promise<T>): Promise<T>
}

/** Initializes only the default tenant navigation selected by the current Edition. */
export class ProvisionTenantNavigation {
  constructor(
    private readonly work: TenantNavigationProvisioningUnitOfWork,
    private readonly registry: ModuleRegistry,
  ) {}

  execute(
    context: PlatformAuditContext,
    input: {
      readonly tenantId: TenantId
      readonly administratorUserId: UserId
      readonly administratorRoleId: string
    },
  ): Promise<{ readonly publishedVersionId: string; readonly grantedCodes: readonly string[] }> {
    return this.work.run(async (transaction) => {
      const writeContext = {
        tenantId: input.tenantId,
        userId: input.administratorUserId,
      }
      const root = await transaction.store.ensureRoot(writeContext)
      let publishedVersionId = root.publishedVersionId

      if (publishedVersionId === null) {
        const configuration = createDefaultConfiguration(this.registry)
        const issues = validateNavigation(configuration, this.registry)
        if (issues.length > 0) {
          throw new ApplicationError({
            code: 'NAVIGATION_VALIDATION_FAILED',
            message: 'Edition 默认导航配置无效',
            status: 422,
            details: { issues },
          })
        }
        const version: NavigationVersion = {
          ...configuration,
          id: newEntityId(),
          revision: await transaction.store.nextRevision(input.tenantId),
          editRevision: 0,
          status: 'DRAFT',
          publishedAt: null,
        }
        await transaction.store.insertVersion(writeContext, root.id, version)
        await transaction.store.markPublished(writeContext, version.id)
        await transaction.store.pointPublished(writeContext, root.id, version.id)
        publishedVersionId = version.id
        await transaction.recordPlatform(
          context,
          input.tenantId,
          'tenant.default_navigation_published',
          root.id,
          { versionId: null },
          { versionId: version.id, revision: version.revision },
        )
      }

      const published = await transaction.store.version(input.tenantId, publishedVersionId)
      if (published === null) {
        throw new ApplicationError({
          code: 'NAVIGATION_VERSION_NOT_FOUND',
          message: '已发布导航版本不存在',
          status: 404,
        })
      }
      const desiredCodes = published.nodes
        .filter((node) => node.accessMode === 'PERMISSION')
        .map((node) => node.code)
        .toSorted()
      const currentCodes = await transaction.store.roleCodes(
        input.tenantId,
        input.administratorRoleId,
      )
      if (JSON.stringify(currentCodes) !== JSON.stringify(desiredCodes)) {
        await transaction.store.replaceRoleCodes(
          writeContext,
          input.administratorRoleId,
          desiredCodes,
        )
        await transaction.recordPlatform(
          context,
          input.tenantId,
          'tenant.initial_navigation_granted',
          input.administratorRoleId,
          { codes: currentCodes },
          { codes: desiredCodes },
        )
      }
      return { publishedVersionId, grantedCodes: desiredCodes }
    })
  }
}
