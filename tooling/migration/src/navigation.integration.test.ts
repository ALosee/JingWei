import { sql } from 'kysely'
import { Migrator } from 'kysely/migration'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { CreatedSession } from '@jingwei/auth'
import { csrfCookieName, csrfHeaderName, sessionCookieName } from '@jingwei/auth/shared'
import { StaticMigrationProvider } from '@jingwei/database'
import { newEntityId, newTenantId, newUserId } from '@jingwei/kernel'
import {
  navigationResponseSchema,
  versionSchema,
  type NavigationVersion,
} from '@jingwei/module-navigation/shared'

import { createApp } from '../../../apps/server/src/app.js'
import { createRuntime, type Runtime } from '../../../apps/server/src/bootstrap/runtime.js'
import { generatedEdition } from '../../../apps/server/src/generated/edition.js'
import { generatedMigrations } from '../../../apps/server/src/generated/migrations.js'

const databaseUrl = process.env.TEST_DATABASE_URL
describe.skipIf(databaseUrl === undefined)('real PostgreSQL navigation/API', () => {
  let runtime: Runtime
  let app: Awaited<ReturnType<typeof createApp>>
  const legacyTenant = newTenantId(),
    legacyRoot = newEntityId(),
    legacyVersion = newEntityId()
  beforeAll(async () => {
    if (
      databaseUrl === undefined ||
      !new URL(databaseUrl).pathname.startsWith('/jingwei_navigation_test_')
    ) {
      throw new Error('Use test:navigation:real; integration tests require a disposable database')
    }
    runtime = createRuntime({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      APP_ORIGIN: 'http://localhost:5173',
    })
    const migrator = new Migrator({
      db: runtime.database.view(),
      provider: new StaticMigrationProvider(generatedMigrations),
    })
    const old = await migrator.migrateTo('20260901040100_navigation_foundation')
    if (old.error !== undefined) throw new Error('Legacy migration failed', { cause: old.error })
    const db = runtime.database.view()
    // Real pre-upgrade rows verify semantic conversion, not only empty-table DDL.
    await sql`INSERT INTO navigation.navigation (id, tenant_id, code, name, kind, created_at, updated_at)
      VALUES (${legacyRoot}, ${legacyTenant}, 'main', 'Legacy', 'WEB', now(), now())`.execute(db)
    await sql`INSERT INTO navigation.navigation_version (id, tenant_id, navigation_id, version, status, published_at, created_at)
      VALUES (${legacyVersion}, ${legacyTenant}, ${legacyRoot}, 1, 'PUBLISHED', now(), now())`.execute(
      db,
    )
    await sql`UPDATE navigation.navigation SET published_version_id = ${legacyVersion} WHERE id = ${legacyRoot}`.execute(
      db,
    )
    await sql`INSERT INTO navigation.navigation_node (id, tenant_id, version_id, type, route_key, path, title, visible, access_mode)
      VALUES (${newEntityId()}, ${legacyTenant}, ${legacyVersion}, 'ROUTE', 'iam.login', '/signin', 'Legacy login', false, 'PUBLIC'),
      (${newEntityId()}, ${legacyTenant}, ${legacyVersion}, 'ROUTE', 'iam.account', '/account', 'Legacy account', true, 'AUTHENTICATED')`.execute(
      db,
    )
    const result = await migrator.migrateToLatest()
    if (result.error instanceof Error) throw result.error
    if (result.error !== undefined) throw new Error('Migration failed', { cause: result.error })
    // Re-running migrations is a no-op.
    expect((await migrator.migrateToLatest()).results).toHaveLength(0)
    const silent = {
      child: () => silent,
      debug() {
        /* quiet test logger */
      },
      info() {
        /* quiet test logger */
      },
      warn() {
        /* quiet test logger */
      },
      error() {
        /* failures asserted through HTTP */
      },
    }
    app = await createApp({ ...runtime, logger: silent })
  })
  afterAll(async () => {
    await runtime.dispose()
  })

  async function request(
    path: string,
    session: CreatedSession | null,
    method = 'GET',
    body?: unknown,
    csrf = true,
  ) {
    const headers = new Headers({ origin: 'http://localhost:5173' })
    if (session) {
      headers.set(
        'cookie',
        sessionCookieName + '=' + session.token + '; ' + csrfCookieName + '=' + session.csrfToken,
      )
      if (csrf) headers.set(csrfHeaderName, session.csrfToken)
    }
    if (body !== undefined) headers.set('content-type', 'application/json')
    return app.request('/api/v1/navigation' + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }
  async function fixture() {
    const db = runtime.database.view()
    const tenantId = newTenantId()
    const tenantCode = 'test-' + tenantId
    await sql`INSERT INTO platform.tenant (id, code, name, status, default_locale, default_timezone, default_currency, settings, created_at, updated_at)
      VALUES (${tenantId}, ${tenantCode}, 'Integration Tenant', 'ACTIVE', 'zh-CN', 'UTC', 'CNY', '{}', now(), now())`.execute(
      db,
    )
    const makeUser = async (admin: boolean) => {
      const userId = newUserId(),
        roleId = newEntityId()
      await sql`INSERT INTO iam."user" (id, tenant_id, username, username_normalized, display_name, status, created_at, updated_at)
        VALUES (${userId}, ${tenantId}, ${userId}, ${userId}, 'Test User', 'ACTIVE', now(), now())`.execute(
        db,
      )
      await sql`INSERT INTO iam.role (id, tenant_id, code, name, status, created_at, updated_at)
        VALUES (${roleId}, ${tenantId}, ${roleId}, 'Test Role', 'ACTIVE', now(), now())`.execute(db)
      await sql`INSERT INTO iam.user_role (tenant_id, user_id, role_id, created_at)
        VALUES (${tenantId}, ${userId}, ${roleId}, now())`.execute(db)
      if (admin) {
        for (const module of generatedEdition.modules)
          for (const permission of module.manifest.permissions) {
            await sql`INSERT INTO iam.role_permission (tenant_id, role_id, permission_code, scope_type, created_at)
            VALUES (${tenantId}, ${roleId}, ${permission.code}, 'ALL', now())`.execute(db)
          }
      }
      return { roleId, userId, session: await runtime.sessionService.create({ tenantId, userId }) }
    }
    const admin = await makeUser(true),
      reader = await makeUser(false)
    const draftResponse = await request('/drafts', admin.session, 'POST', { sourceVersionId: null })
    expect(draftResponse.status).toBe(201)
    const draft = versionSchema.parse(await draftResponse.json())
    const published = await request('/versions/' + draft.id + '/publish', admin.session, 'POST', {
      expectedEditRevision: 0,
      expectedPublishedVersionId: null,
    })
    expect(published.status).toBe(200)
    return {
      tenantId,
      tenantCode,
      admin,
      reader,
      makeUser,
      published: versionSchema.parse(await published.json()),
    }
  }
  function saveBody(version: NavigationVersion) {
    return {
      authEntryCode: version.authEntryCode,
      homeCode: version.homeCode,
      nodes: version.nodes,
      expectedEditRevision: version.editRevision,
    }
  }

  it('upgrades legacy ROUTE/visible data while preserving the published pointer', async () => {
    const db = runtime.database.view()
    const nodes = await sql<{
      code: string
      type: string
      layout: string
      name: string
      params: unknown
    }>`
      SELECT code, type, layout, name, params FROM navigation.navigation_node
      WHERE tenant_id = ${legacyTenant} ORDER BY code`.execute(db)
    expect(nodes.rows).toEqual([
      { code: 'iam.account', type: 'MENU', layout: 'base', name: 'Legacy account', params: {} },
      { code: 'iam.login', type: 'PAGE', layout: 'blank', name: 'Legacy login', params: {} },
    ])
    const pointer = await sql<{ published_version_id: string }>`SELECT published_version_id
      FROM navigation.navigation WHERE id = ${legacyRoot}`.execute(db)
    expect(pointer.rows[0]?.published_version_id).toBe(legacyVersion)
  })

  it('loads database PUBLIC pages, enforces authentication/CSRF, and fails closed for missing tenants', async () => {
    const f = await fixture()
    const response = await request('/bootstrap?tenantCode=' + f.tenantCode, null)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const nav = navigationResponseSchema.parse(await response.json())
    expect(nav.versionId).toBe(f.published.id)
    expect(nav.nodes.map((node) => node.type)).toEqual(['PAGE'])
    expect((await request('/me', null)).status).toBe(401)
    expect((await request('/drafts', null, 'POST', { sourceVersionId: null })).status).toBe(401)
    expect(
      (await request('/drafts', f.admin.session, 'POST', { sourceVersionId: null }, false)).status,
    ).toBe(403)
    expect((await request('/bootstrap?tenantCode=does-not-exist', null)).status).toBe(404)
    expect((await request('/admin', f.reader.session)).status).toBe(403)
    expect((await request('/versions/not-uuid', f.admin.session)).status).toBe(400)
    const malformed = await app.request('/api/v1/navigation/drafts', {
      method: 'POST',
      body: '{',
      headers: {
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
        cookie:
          sessionCookieName +
          '=' +
          f.admin.session.token +
          '; ' +
          csrfCookieName +
          '=' +
          f.admin.session.csrfToken,
        [csrfHeaderName]: f.admin.session.csrfToken,
      },
    })
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('saves defaults/layout in draft, rejects stale writes and keeps published versions immutable', async () => {
    const f = await fixture()
    const draft = versionSchema.parse(
      await (await request('/drafts', f.admin.session, 'POST', { sourceVersionId: null })).json(),
    )
    expect(draft.nodes[0]?.id).not.toBe(f.published.nodes[0]?.id)
    const account = draft.nodes.find((node) => node.code === 'iam.account')
    if (!account) throw new Error('fixture')
    account.name = '自定义个人中心'
    account.path = '/profile/:id'
    account.params = { id: 'me' }
    account.query = { tab: 'preferences', tags: ['a', 'b'] }
    const savedResponse = await request(
      '/versions/' + draft.id,
      f.admin.session,
      'PUT',
      saveBody(draft),
    )
    expect(savedResponse.status).toBe(200)
    const saved = versionSchema.parse(await savedResponse.json())
    expect(saved.editRevision).toBe(1)
    expect(saved.nodes.find((node) => node.code === 'iam.account')?.query).toEqual(account.query)
    expect(
      (await request('/versions/' + draft.id, f.admin.session, 'PUT', saveBody(draft))).status,
    ).toBe(409)
    expect(
      (await request('/versions/' + f.published.id, f.admin.session, 'PUT', saveBody(f.published)))
        .status,
    ).toBe(409)
    expect(
      (
        await request('/versions/' + saved.id + '/publish', f.admin.session, 'POST', {
          expectedEditRevision: 1,
          expectedPublishedVersionId: f.published.id,
        })
      ).status,
    ).toBe(200)
    const me = navigationResponseSchema.parse(await (await request('/me', f.reader.session)).json())
    expect(me.nodes.find((node) => node.code === 'iam.account')?.name).toBe('自定义个人中心')
    await expect(
      sql`UPDATE navigation.navigation_node SET name = 'illegal' WHERE version_id = ${saved.id}`.execute(
        runtime.database.view(),
      ),
    ).rejects.toThrow('immutable')
  })

  it('serializes concurrent publication and supports rollback without editing snapshots', async () => {
    const f = await fixture()
    const drafts = await Promise.all(
      [1, 2].map(async () =>
        versionSchema.parse(
          await (
            await request('/drafts', f.admin.session, 'POST', { sourceVersionId: null })
          ).json(),
        ),
      ),
    )
    const responses = await Promise.all(
      drafts.map((draft) =>
        request('/versions/' + draft.id + '/publish', f.admin.session, 'POST', {
          expectedEditRevision: 0,
          expectedPublishedVersionId: f.published.id,
        }),
      ),
    )
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    const current = navigationResponseSchema.parse(
      await (await request('/me', f.admin.session)).json(),
    )
    expect(
      (
        await request('/versions/' + f.published.id + '/rollback', f.admin.session, 'POST', {
          expectedEditRevision: 0,
          expectedPublishedVersionId: current.versionId,
        })
      ).status,
    ).toBe(200)
    const rolledBack = navigationResponseSchema.parse(
      await (await request('/me', f.admin.session)).json(),
    )
    expect(rolledBack.versionId).toBe(f.published.id)
  })

  it('authorizes external links by navigation code, not routeKey, and never grants functional API rights', async () => {
    const f = await fixture()
    const draft = versionSchema.parse(
      await (await request('/drafts', f.admin.session, 'POST', { sourceVersionId: null })).json(),
    )
    const account = draft.nodes.find((node) => node.code === 'iam.account')
    if (!account) throw new Error('fixture')
    draft.nodes.push({
      ...account,
      id: newEntityId(),
      code: 'external.help',
      name: '外部帮助',
      type: 'EXTERNAL_LINK',
      routeKey: null,
      path: null,
      layout: null,
      href: 'https://example.com/help',
      externalTarget: 'BLANK',
      accessMode: 'PERMISSION',
    })
    const saved = versionSchema.parse(
      await (
        await request('/versions/' + draft.id, f.admin.session, 'PUT', saveBody(draft))
      ).json(),
    )
    await request('/versions/' + saved.id + '/publish', f.admin.session, 'POST', {
      expectedEditRevision: saved.editRevision,
      expectedPublishedVersionId: f.published.id,
    })
    const secondRole = await f.makeUser(false)
    await sql`INSERT INTO iam.user_role (tenant_id, user_id, role_id, created_at)
      VALUES (${f.tenantId}, ${f.reader.userId}, ${secondRole.roleId}, now())`.execute(
      runtime.database.view(),
    )
    expect(
      (
        await request('/roles/' + secondRole.roleId + '/grants', f.admin.session, 'PUT', {
          codes: ['external.help'],
          expectedCodes: [],
        })
      ).status,
    ).toBe(200)
    const granted = await request('/roles/' + f.reader.roleId + '/grants', f.admin.session, 'PUT', {
      codes: ['navigation.manage'],
      expectedCodes: [],
    })
    expect(granted.status).toBe(200)
    let nav = navigationResponseSchema.parse(await (await request('/me', f.reader.session)).json())
    expect(nav.nodes.find((node) => node.code === 'external.help')?.routeKey).toBeNull()
    expect(nav.nodes.map((node) => node.code)).toContain('navigation.manage')
    expect((await request('/admin', f.reader.session)).status).toBe(403)
    expect(
      (
        await request('/roles/' + f.reader.roleId + '/grants', f.admin.session, 'PUT', {
          codes: [],
          expectedCodes: [],
        })
      ).status,
    ).toBe(409)
    // Role status changes affect the next request; the session is not a stale permission cache.
    await sql`UPDATE iam.role SET status = 'DISABLED' WHERE id = ${f.reader.roleId}`.execute(
      runtime.database.view(),
    )
    nav = navigationResponseSchema.parse(await (await request('/me', f.reader.session)).json())
    expect(nav.nodes.map((node) => node.code)).not.toContain('navigation.manage')
    expect(nav.nodes.map((node) => node.code)).toContain('external.help')
    expect(
      (
        await request('/roles/' + secondRole.roleId + '/grants', f.admin.session, 'PUT', {
          codes: [],
          expectedCodes: ['external.help'],
        })
      ).status,
    ).toBe(200)
    nav = navigationResponseSchema.parse(await (await request('/me', f.reader.session)).json())
    expect(nav.nodes.map((node) => node.code)).not.toContain('external.help')
  })

  it('isolates tenant versions, role grants and authenticated bootstrap tenant selection', async () => {
    const a = await fixture(),
      b = await fixture()
    expect((await request('/versions/' + a.published.id, b.admin.session)).status).toBe(404)
    expect(
      (await request('/versions/' + a.published.id, b.admin.session, 'PUT', saveBody(a.published)))
        .status,
    ).toBe(404)
    expect(
      (
        await request('/roles/' + a.reader.roleId + '/grants', b.admin.session, 'PUT', {
          codes: ['navigation.manage'],
          expectedCodes: [],
        })
      ).status,
    ).toBe(404)
    const nav = navigationResponseSchema.parse(
      await (await request('/bootstrap?tenantCode=' + a.tenantCode, b.admin.session)).json(),
    )
    expect(nav.versionId).toBe(b.published.id)
  })

  it('rolls back pointer, snapshot and audit when transactional outbox append fails', async () => {
    const f = await fixture()
    const draft = versionSchema.parse(
      await (await request('/drafts', f.admin.session, 'POST', { sourceVersionId: null })).json(),
    )
    const db = runtime.database.view()
    const auditCount = async () =>
      (
        await sql<{
          count: number
        }>`SELECT count(*)::int as count FROM platform.audit_log WHERE tenant_id = ${f.tenantId}`.execute(
          db,
        )
      ).rows[0]?.count
    const before = await auditCount()
    await sql`CREATE FUNCTION platform.test_reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected outbox failure'; END $$`.execute(
      db,
    )
    await sql`CREATE TRIGGER test_reject_outbox BEFORE INSERT ON platform.outbox FOR EACH ROW EXECUTE FUNCTION platform.test_reject_outbox()`.execute(
      db,
    )
    try {
      const response = await request(
        '/versions/' + draft.id + '/publish',
        f.admin.session,
        'POST',
        { expectedEditRevision: 0, expectedPublishedVersionId: f.published.id },
      )
      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('injected')
    } finally {
      await sql`DROP TRIGGER test_reject_outbox ON platform.outbox`.execute(db)
      await sql`DROP FUNCTION platform.test_reject_outbox()`.execute(db)
    }
    expect(await auditCount()).toBe(before)
    const current = navigationResponseSchema.parse(
      await (await request('/me', f.admin.session)).json(),
    )
    expect(current.versionId).toBe(f.published.id)
    expect(
      versionSchema.parse(await (await request('/versions/' + draft.id, f.admin.session)).json())
        .status,
    ).toBe('DRAFT')
  })
})
