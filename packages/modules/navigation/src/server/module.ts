import type { ServerModule } from '@jingwei/module-sdk/server'
import { createIamAccess } from '@jingwei/module-iam/server/public'
import { manifest } from '../manifest.js'
import { ResolveNavigation } from './application/resolve-navigation.js'
import { ManageNavigation } from './application/manage-navigation.js'
import { createNavigationRoutes } from './api/routes.js'
import { PostgresNavigationStore, PostgresNavigationUnitOfWork, type NavigationDatabase } from './infrastructure/navigation-store.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const database = context.database.view<NavigationDatabase>()
    const store = new PostgresNavigationStore(database)
    const access = createIamAccess(context.database, context.moduleRegistry)
    const manage = new ManageNavigation(store, new PostgresNavigationUnitOfWork(database), context.moduleRegistry, access)
    const resolver = new ResolveNavigation(store, context.moduleRegistry, access)
    return Promise.resolve({ id: manifest.id, basePath: '/navigation',
      routes: createNavigationRoutes(resolver, manage, context.tenantDirectory, context.config.bootstrapTenantCode),
    })
  },
}
