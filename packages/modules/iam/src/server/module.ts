import { PostgresAuditWriter } from '@jingwei/audit'
import { Argon2idPasswordHasher } from '@jingwei/auth'
import { systemClock } from '@jingwei/kernel'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createIamRoutes } from './api/routes.js'
import {
  ChangeAccountPassword,
  ReadAccountProfile,
  ReadAccountRoles,
  UpdateAccountProfile,
} from './application/account-profile.js'
import { AuthenticateUser } from './application/authenticate-user.js'
import { ManageIamRoles } from './application/manage-roles.js'
import { ManageIamUsers } from './application/manage-users.js'
import { ReadPermissionCatalog } from './application/permission-catalog.js'
import { ReadCurrentUser } from './application/read-current-user.js'
import { SessionLifecycle } from './application/session-lifecycle.js'
import { PostgresAccountStore } from './infrastructure/account-store.pg.js'
import { PostgresCredentialStore, type IamDatabase } from './infrastructure/credential-reader.pg.js'
import { PostgresCurrentUserReader } from './infrastructure/current-user-reader.pg.js'
import { PostgresRoleStore, PostgresRoleUnitOfWork } from './infrastructure/role-store.pg.js'
import {
  PostgresUserAdminStore,
  PostgresUserAdminUnitOfWork,
} from './infrastructure/user-admin-store.pg.js'
import { createIamAccess } from './public/create-access.js'

export const serverModule: ServerModule = {
  manifest,
  async install(context) {
    const database = context.database.view<IamDatabase>()
    const credentials = new PostgresCredentialStore(database)
    const currentUsers = new PostgresCurrentUserReader(database)
    const accounts = new PostgresAccountStore(database)
    const passwords = new Argon2idPasswordHasher()
    const dummyPasswordHash = await passwords.hash('not-a-real-jingwei-user-password')
    const audit = new PostgresAuditWriter(database)
    const authenticateUser = new AuthenticateUser({
      tenants: context.tenantDirectory,
      credentials,
      unitOfWork: credentials,
      passwords,
      sessions: context.sessionService,
      clock: systemClock,
      dummyPasswordHash,
      policy: context.config.login,
    })
    const sessionLifecycle = new SessionLifecycle({ sessions: context.sessionService, audit })
    const access = createIamAccess(context.database, context.moduleRegistry)
    const manageRoles = new ManageIamRoles(
      new PostgresRoleStore(database),
      new PostgresRoleUnitOfWork(database),
      access,
      context.moduleRegistry,
      new ReadPermissionCatalog(context.moduleRegistry),
    )
    const manageUsers = new ManageIamUsers(
      new PostgresUserAdminStore(database),
      new PostgresUserAdminUnitOfWork(database),
      access,
      passwords,
      context.sessionService,
      systemClock,
    )

    return {
      id: manifest.id,
      basePath: '/iam',
      routes: createIamRoutes({
        authenticateUser,
        readCurrentUser: new ReadCurrentUser(currentUsers),
        sessions: sessionLifecycle,
        readAccount: new ReadAccountProfile(accounts),
        updateAccount: new UpdateAccountProfile({ accounts, clock: systemClock }),
        changePassword: new ChangeAccountPassword({
          accounts,
          passwords,
          sessions: context.sessionService,
          clock: systemClock,
        }),
        readAccountRoles: new ReadAccountRoles(accounts),
        manageRoles,
        manageUsers,
        secureCookies: context.config.environment === 'production',
        logger: context.logger,
      }),
    }
  },
}
