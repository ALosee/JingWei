import {
  createAuthorizationEvaluator,
  createIamAccess,
  createIamUserDirectory,
  type OrganizationalScopeFacts,
} from '@jingwei/module-iam/server/public'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createOrganizationRoutes } from './api/routes.js'
import { ManageOrganizationMembers } from './application/manage-org-members.js'
import { ManageOrganizationUnits } from './application/manage-org-units.js'
import { ManageOrganizationPositions } from './application/manage-positions.js'
import { ReadOrganizationalScopeOptions } from './application/read-scope-options.js'
import {
  PostgresMembershipStore,
  PostgresMembershipUnitOfWork,
} from './infrastructure/membership-store.pg.js'
import {
  PostgresOrgUnitStore,
  PostgresOrgUnitOfWork,
  type OrganizationDatabase,
} from './infrastructure/org-unit-store.pg.js'
import {
  PostgresPositionStore,
  PostgresPositionUnitOfWork,
} from './infrastructure/position-store.pg.js'
import { createOrganizationalScopeFacts } from './public/create-organizational-scope-facts.js'

export interface OrganizationServerModuleDependencies {
  readonly organizationalScopeFacts?: OrganizationalScopeFacts
}

export function createOrganizationServerModule(
  dependencies: OrganizationServerModuleDependencies = {},
): ServerModule {
  return {
    manifest,
    install(context) {
      const database = context.database.view<OrganizationDatabase>()
      const store = new PostgresOrgUnitStore(database)
      const access = createIamAccess(context.database, context.moduleRegistry, context.logger)
      const organizationalScopeFacts =
        dependencies.organizationalScopeFacts ?? createOrganizationalScopeFacts(context.database)
      const evaluator = createAuthorizationEvaluator(
        context.database,
        context.moduleRegistry,
        organizationalScopeFacts,
        context.logger,
      )
      const manage = new ManageOrganizationUnits(
        store,
        new PostgresOrgUnitOfWork(database),
        access,
        evaluator,
      )
      const positions = new ManageOrganizationPositions(
        new PostgresPositionStore(database),
        new PostgresPositionUnitOfWork(database),
        access,
        evaluator,
      )
      const members = new ManageOrganizationMembers(
        new PostgresMembershipStore(database),
        new PostgresMembershipUnitOfWork(database),
        access,
        createIamUserDirectory(context.database),
        evaluator,
      )
      const scopeOptions = new ReadOrganizationalScopeOptions(store, access)
      return Promise.resolve({
        id: manifest.id,
        basePath: '/organization',
        routes: createOrganizationRoutes(manage, positions, members, scopeOptions),
      })
    },
  }
}

export const serverModule = createOrganizationServerModule()
