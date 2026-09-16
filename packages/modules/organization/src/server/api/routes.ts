import type { Context } from 'hono'

import { ApplicationError } from '@jingwei/kernel'
import { createApiRouter, type ServerAppEnv } from '@jingwei/module-sdk/server'

import type { ManageOrganizationMembers } from '../application/manage-org-members.js'
import type { ManageOrganizationUnits } from '../application/manage-org-units.js'
import type { ManageOrganizationPositions } from '../application/manage-positions.js'
import type { ReadOrganizationalScopeOptions } from '../application/read-scope-options.js'
import { organizationApiRoutes } from './openapi.js'

function auth(context: Context<ServerAppEnv>) {
  const value = context.get('authContext')
  if (value === null)
    throw new ApplicationError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '需要登录后访问',
      status: 401,
    })
  return value
}

export function createOrganizationRoutes(
  manage: ManageOrganizationUnits,
  positions: ManageOrganizationPositions,
  members: ManageOrganizationMembers,
  scopeOptions: ReadOrganizationalScopeOptions,
) {
  const app = createApiRouter()
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.openapi(organizationApiRoutes.scopeOptions, async (c) =>
    c.json(await scopeOptions.list(auth(c)), 200),
  )
  app.openapi(organizationApiRoutes.tree, async (c) => c.json(await manage.tree(auth(c)), 200))
  app.openapi(organizationApiRoutes.create, async (c) =>
    c.json(await manage.create(auth(c), c.req.valid('json')), 201),
  )
  app.openapi(organizationApiRoutes.update, async (c) =>
    c.json(await manage.update(auth(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  app.openapi(organizationApiRoutes.remove, async (c) =>
    c.json(await manage.remove(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(organizationApiRoutes.listPositions, async (c) =>
    c.json(await positions.listByUnit(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(organizationApiRoutes.createPosition, async (c) =>
    c.json(await positions.create(auth(c), c.req.valid('param').id, c.req.valid('json')), 201),
  )
  app.openapi(organizationApiRoutes.updatePosition, async (c) =>
    c.json(
      await positions.update(
        auth(c),
        c.req.valid('param').id,
        c.req.valid('param').positionId,
        c.req.valid('json'),
      ),
      200,
    ),
  )
  app.openapi(organizationApiRoutes.removePosition, async (c) =>
    c.json(
      await positions.remove(auth(c), c.req.valid('param').id, c.req.valid('param').positionId),
      200,
    ),
  )
  app.openapi(organizationApiRoutes.listMembers, async (c) =>
    c.json(await members.listByUnit(auth(c), c.req.valid('param').id), 200),
  )
  app.openapi(organizationApiRoutes.listMemberCandidates, async (c) =>
    c.json(await members.listMemberCandidates(auth(c)), 200),
  )
  app.openapi(organizationApiRoutes.createMember, async (c) =>
    c.json(await members.add(auth(c), c.req.valid('param').id, c.req.valid('json')), 201),
  )
  app.openapi(organizationApiRoutes.updateMember, async (c) =>
    c.json(
      await members.update(
        auth(c),
        c.req.valid('param').id,
        c.req.valid('param').userId,
        c.req.valid('json'),
      ),
      200,
    ),
  )
  app.openapi(organizationApiRoutes.removeMember, async (c) =>
    c.json(
      await members.remove(auth(c), c.req.valid('param').id, c.req.valid('param').userId),
      200,
    ),
  )
  app.openapi(organizationApiRoutes.replaceMemberPositions, async (c) =>
    c.json(
      await members.replacePositions(
        auth(c),
        c.req.valid('param').id,
        c.req.valid('param').userId,
        c.req.valid('json'),
      ),
      200,
    ),
  )
  return app
}
