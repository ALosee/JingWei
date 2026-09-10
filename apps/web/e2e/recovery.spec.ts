import { expect, test } from '@playwright/test'

import {
  versionSchema,
  type NavigationNode,
  type NavigationResponse,
  type NavigationVersion,
} from '@jingwei/module-navigation/shared'

const id = (value: number) => '00000000-0000-7000-8000-' + String(value).padStart(12, '0')
const node = (overrides: Partial<NavigationNode>): NavigationNode => ({
  id: id(1),
  code: 'iam.login',
  name: '登录',
  type: 'PAGE',
  status: 'ENABLED',
  parentId: null,
  routeKey: 'iam.login',
  path: '/signin',
  layout: 'blank',
  icon: null,
  sortOrder: 0,
  accessMode: 'PUBLIC',
  href: null,
  externalTarget: null,
  params: {},
  query: {},
  ...overrides,
})
const login = node({})
const group = node({
  id: id(2),
  code: 'workspace',
  name: '工作区',
  type: 'GROUP',
  routeKey: null,
  path: null,
  layout: null,
  accessMode: null,
})
const directory = node({
  ...group,
  id: id(3),
  code: 'system',
  name: '系统管理',
  type: 'DIRECTORY',
  parentId: group.id,
})
const manage = node({
  id: id(4),
  code: 'nav.configure',
  name: '导航管理',
  type: 'MENU',
  parentId: directory.id,
  routeKey: 'navigation.manage',
  path: '/navigation/manage',
  layout: 'base',
  accessMode: 'PERMISSION',
})
const account = node({
  id: id(5),
  code: 'iam.account',
  name: '个人账号',
  type: 'PAGE',
  parentId: manage.id,
  routeKey: 'iam.account',
  path: '/account/:id',
  layout: 'base',
  accessMode: 'AUTHENTICATED',
})
const external = node({
  id: id(6),
  code: 'external.help',
  name: '帮助中心',
  type: 'EXTERNAL_LINK',
  parentId: group.id,
  routeKey: null,
  path: null,
  layout: null,
  accessMode: 'PERMISSION',
  href: 'https://example.com/help',
  externalTarget: 'BLANK',
})
const response = (nodes: NavigationNode[]): NavigationResponse => ({
  schemaVersion: 2,
  versionId: id(100),
  publishedRevision: 1,
  authEntryCode: login.code,
  homeCode: manage.code,
  nodes,
})

test('the static recovery route remains available', async ({ page }) => {
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ status: 503, json: { code: 'NAVIGATION_NOT_PUBLISHED', message: '尚未发布' } }),
  )
  await page.goto('/__recovery')
  await expect(page.getByRole('heading', { name: '恢复入口' })).toBeVisible()
})

test('anonymous refresh rematches PAGE without requesting user navigation', async ({ page }) => {
  let meRequests = 0
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ json: response([login]) }),
  )
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({ json: { authenticated: false } }),
  )
  await page.route('**/api/v1/navigation/me', (route) => {
    meRequests++
    return route.fulfill({ status: 500 })
  })
  await page.goto('/signin')
  await expect(page.getByRole('heading', { name: '经纬企业平台' })).toBeVisible()
  expect(meRequests).toBe(0)
  await expect(page.getByRole('complementary')).toHaveCount(0)
})

test('groups, directories, hidden dynamic pages and safe links remain distinct on refresh', async ({
  page,
}) => {
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ json: response([login]) }),
  )
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({ json: { authenticated: true, user: { id: id(200), tenantId: id(201) } } }),
  )
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, group, directory, manage, account, external]) }),
  )
  await page.goto('/account/123?tab=security')
  await expect(page.getByRole('heading', { name: '个人账号' })).toBeVisible()
  await expect(page).toHaveURL(/\/account\/123\?tab=security$/u)
  const menu = page.getByRole('complementary', { name: '主导航' })
  await expect(menu.getByText('工作区', { exact: true })).toBeVisible()
  await expect(menu.locator('details')).toHaveCount(1)
  await expect(menu.getByRole('link', { name: '导航管理' })).toBeVisible()
  await expect(menu.getByRole('link', { name: '登录' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: '个人账号' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: '帮助中心' })).toHaveAttribute('target', '_blank')
  await expect(menu.getByRole('link', { name: '帮助中心' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  await menu.locator('summary').click()
  await expect(menu.getByRole('link', { name: '导航管理' })).not.toBeVisible()
  await expect(menu.getByRole('link', { name: '帮助中心' })).toBeVisible()
})

test('editor saves a complete typed draft with CSRF', async ({ page, context }) => {
  const nodes = [login, group, directory, manage, account, external]
  const published: NavigationVersion = {
    id: id(100),
    revision: 1,
    editRevision: 0,
    status: 'PUBLISHED',
    publishedAt: '2026-09-02T00:00:00.000Z',
    authEntryCode: login.code,
    homeCode: manage.code,
    nodes,
  }
  let draft: NavigationVersion = {
    ...published,
    id: id(101),
    revision: 2,
    status: 'DRAFT',
    publishedAt: null,
  }
  let created = false
  let savedName: unknown
  let csrf: string | undefined
  await context.addCookies([
    { name: 'jingwei_csrf', value: 'test-csrf', url: 'http://127.0.0.1:4173' },
  ])
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({ json: { authenticated: true, user: { id: id(200), tenantId: id(201) } } }),
  )
  await page.route('**/api/v1/navigation/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/bootstrap')) return route.fulfill({ json: response([login]) })
    if (path.endsWith('/me')) return route.fulfill({ json: response(nodes) })
    if (path.endsWith('/catalog'))
      return route.fulfill({
        json: {
          routes: [
            {
              key: 'iam.login',
              layout: 'blank',
              allowedLayouts: ['blank'],
              allowedAccessModes: ['PUBLIC'],
            },
            {
              key: 'iam.account',
              layout: 'base',
              allowedLayouts: ['base'],
              allowedAccessModes: ['AUTHENTICATED'],
            },
            {
              key: 'navigation.manage',
              layout: 'base',
              allowedLayouts: ['base'],
              allowedAccessModes: ['PERMISSION'],
            },
          ],
          roles: [{ id: id(300), code: 'reader', name: 'Reader' }],
        },
      })
    if (path.endsWith('/admin'))
      return route.fulfill({
        json: {
          publishedVersionId: published.id,
          versions: (created ? [draft, published] : [published]).map((version) =>
            versionSchema.omit({ nodes: true }).strip().parse(version),
          ),
        },
      })
    if (path.endsWith('/drafts')) {
      created = true
      return route.fulfill({ status: 201, json: draft })
    }
    if (path.endsWith('/' + published.id)) return route.fulfill({ json: published })
    if (path.endsWith('/' + draft.id)) {
      if (route.request().method() === 'PUT') {
        const body: unknown = route.request().postDataJSON()
        const { saveDraftSchema } = await import('@jingwei/module-navigation/shared')
        const input = saveDraftSchema.parse(body)
        expect(input.expectedEditRevision).toBe(0)
        csrf = route.request().headers()['x-csrf-token']
        draft = {
          ...draft,
          authEntryCode: input.authEntryCode,
          homeCode: input.homeCode,
          nodes: input.nodes,
          editRevision: 1,
        }
        savedName = input.nodes.find((item) => item.code === manage.code)?.name
      }
      return route.fulfill({ json: draft })
    }
    return route.fulfill({
      status: 403,
      json: { code: 'PERMISSION_DENIED', message: '没有功能权限', requestId: id(999) },
    })
  })
  await page.goto('/navigation/manage')
  await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '基于所选版本创建草稿' }).click()
  await expect(page.getByRole('status')).toContainText('已创建草稿')
  await page.getByRole('button', { name: '导航管理 MENU · nav.configure · ENABLED' }).click()
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('新的导航名称')
  await page
    .getByRole('textbox', { name: '默认 query（JSON）', exact: true })
    .fill('{"section":"nodes"}')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('草稿已保存')
  expect(savedName).toBe('新的导航名称')
  expect(csrf).toBe('test-csrf')
  expect(draft.nodes.find((item) => item.code === manage.code)?.query).toEqual({ section: 'nodes' })
  await page.getByRole('combobox', { name: '角色', exact: true }).selectOption(id(300))
  await expect(page.getByRole('alert')).toContainText('没有功能权限')
  await expect(page.getByRole('button', { name: '保存角色导航授权' })).toBeDisabled()
})
