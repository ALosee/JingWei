import { PostgresPlatformAuditWriter } from '@jingwei/audit'
import { Argon2idPasswordHasher } from '@jingwei/auth'
import type { AppConfig } from '@jingwei/config'
import type { DatabaseRuntime } from '@jingwei/database'
import { systemClock } from '@jingwei/kernel'
import { createTenantIamProvisioner } from '@jingwei/module-iam/server/public'
import { createTenantNavigationProvisioner } from '@jingwei/module-navigation/server/public'
import type { ModuleRegistry } from '@jingwei/module-sdk'
import type { AppLogger } from '@jingwei/observability'
import { createTenantManagement, type TenantSessionRevoker } from '@jingwei/tenancy'

import { createControlPlaneRoutes } from './api/routes.js'
import { BootstrapPlatformOperator } from './application/bootstrap-operator.js'
import {
  AuthenticateOperator,
  OperatorSessionLifecycle,
  ReadOperatorSession,
} from './application/operator-auth.js'
import { ProvisionTenant } from './application/provision-tenant.js'
import type { ControlPlaneDatabase } from './infrastructure/database.js'
import { PostgresOperatorStore } from './infrastructure/operator-store.pg.js'
import { PostgresTenantProvisioningCoordinator } from './infrastructure/tenant-provisioning-coordinator.pg.js'
import { OperatorSessionService, PostgresOperatorSessionRepository } from './operator-session.js'

export function createOperatorSessionService(
  database: DatabaseRuntime,
  config: AppConfig,
): OperatorSessionService {
  const view = database.view<ControlPlaneDatabase>()
  const operators = new PostgresOperatorStore(view)
  return new OperatorSessionService(
    new PostgresOperatorSessionRepository(view),
    operators,
    systemClock,
    config.session,
  )
}

export async function createControlPlaneServer(dependencies: {
  readonly database: DatabaseRuntime
  readonly config: AppConfig
  readonly logger: AppLogger
  readonly registry: ModuleRegistry
  readonly tenantSessions: TenantSessionRevoker
  readonly operatorSessions: OperatorSessionService
}) {
  const view = dependencies.database.view<ControlPlaneDatabase>()
  const operators = new PostgresOperatorStore(view)
  const passwords = new Argon2idPasswordHasher()
  const dummyPasswordHash = await passwords.hash('not-a-real-platform-operator-password')
  const tenantOperations = createTenantOperations({
    database: dependencies.database,
    registry: dependencies.registry,
    tenantSessions: dependencies.tenantSessions,
  })
  const audit = new PostgresPlatformAuditWriter(view)
  return createControlPlaneRoutes({
    authenticate: new AuthenticateOperator(
      operators,
      passwords,
      dependencies.operatorSessions,
      systemClock,
      dummyPasswordHash,
      dependencies.config.login,
    ),
    readSession: new ReadOperatorSession(operators),
    sessionLifecycle: new OperatorSessionLifecycle(dependencies.operatorSessions, audit),
    sessions: dependencies.operatorSessions,
    tenants: tenantOperations.tenants,
    provision: tenantOperations.provision,
    secureCookies: dependencies.config.http.secureCookies,
    logger: dependencies.logger,
  })
}

export function createTenantOperations(dependencies: {
  readonly database: DatabaseRuntime
  readonly registry: ModuleRegistry
  readonly tenantSessions: TenantSessionRevoker
}) {
  const tenants = createTenantManagement(dependencies.database, dependencies.tenantSessions)
  return {
    tenants,
    provision: new ProvisionTenant(
      tenants,
      createTenantIamProvisioner(dependencies.database, dependencies.registry),
      createTenantNavigationProvisioner(dependencies.database, dependencies.registry),
      new PostgresTenantProvisioningCoordinator(dependencies.database.view<unknown>()),
    ),
  }
}

export function createPlatformOperatorBootstrap(database: DatabaseRuntime) {
  const store = new PostgresOperatorStore(database.view<ControlPlaneDatabase>())
  return new BootstrapPlatformOperator(store, new Argon2idPasswordHasher(), systemClock)
}
