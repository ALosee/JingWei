import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createOrganizationRoutes } from './api/routes.js'
import { ManageOrganizationUnits } from './application/manage-org-units.js'
import { ManageOrganizationPositions } from './application/manage-positions.js'
import {
  PostgresOrgUnitStore,
  PostgresOrgUnitOfWork,
  type OrganizationDatabase,
} from './infrastructure/org-unit-store.pg.js'
import {
  PostgresPositionStore,
  PostgresPositionUnitOfWork,
} from './infrastructure/position-store.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const database = context.database.view<OrganizationDatabase>()
    const store = new PostgresOrgUnitStore(database)
    const access = createIamAccess(context.database, context.moduleRegistry)
    const manage = new ManageOrganizationUnits(store, new PostgresOrgUnitOfWork(database), access)
    const positions = new ManageOrganizationPositions(
      new PostgresPositionStore(database),
      new PostgresPositionUnitOfWork(database),
      access,
    )
    return Promise.resolve({
      id: manifest.id,
      basePath: '/organization',
      routes: createOrganizationRoutes(manage, positions),
    })
  },
}
