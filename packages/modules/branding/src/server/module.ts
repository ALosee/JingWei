import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createBrandingRoutes } from './api/routes.js'
import { ManageBranding } from './application/manage-branding.js'
import { ResolveBranding } from './application/resolve-branding.js'
import {
  PostgresBrandingStore,
  PostgresBrandingUnitOfWork,
  type BrandingDatabase,
} from './infrastructure/branding-store.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const database = context.database.view<BrandingDatabase>()
    const store = new PostgresBrandingStore(database)
    const resolve = new ResolveBranding(store)
    const manage = new ManageBranding(
      store,
      new PostgresBrandingUnitOfWork(database),
      createIamAccess(context.database, context.moduleRegistry, context.logger),
    )
    return Promise.resolve({
      id: manifest.id,
      basePath: '/branding',
      routes: createBrandingRoutes(
        resolve,
        manage,
        context.tenantDirectory,
        context.config.bootstrapTenantCode,
      ),
    })
  },
}
