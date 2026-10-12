import { expect, test } from '@playwright/test'

import { defaultEffectiveBrand } from '@jingwei/module-branding/shared'
import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'

const id = (value: number) => '00000000-0000-7000-8000-' + String(value).padStart(12, '0')
const now = '2026-09-01T00:00:00.000Z'
const login: NavigationNode = {
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
}
const roles: NavigationNode = {
  ...login,
  id: id(2),
  code: 'iam.roles',
  name: '角色管理',
  type: 'MENU',
  routeKey: 'iam.roles',
  path: '/iam/roles',
  layout: 'base',
  icon: 'lucide:shield-check',
  accessMode: 'PERMISSION',
}
const users: NavigationNode = {
  ...roles,
  id: id(3),
  code: 'iam.users',
  name: '用户管理',
  routeKey: 'iam.users',
  path: '/iam/users',
}
const organization: NavigationNode = {
  ...roles,
  id: id(4),
  code: 'organization.units',
  name: '组织架构',
  routeKey: 'organization.units',
  path: '/organization/units',
}
const dictionary: NavigationNode = {
  ...roles,
  id: id(5),
  code: 'dictionary.entries',
  name: '数据字典',
  routeKey: 'dictionary.entries',
  path: '/dictionary/entries',
}
const response = (nodes: NavigationNode[]): NavigationResponse => ({
  schemaVersion: 2,
  versionId: id(100),
  publishedRevision: 1,
  authEntryCode: login.code,
  homeCode: roles.code,
  nodes,
})
const role = {
  id: id(10),
  code: 'tenant-administrator',
  name: '租户管理员',
  description: '管理基础模块',
  status: 'ACTIVE',
  isSystem: true,
  assignmentCount: 1,
  createdAt: now,
  updatedAt: now,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ json: response([login]) }),
  )
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        permissions: [
          'iam.role.view',
          'iam.role.manage',
          'iam.user.view',
          'iam.user.manage',
          'organization.view',
          'organization.manage',
          'dictionary.view',
          'dictionary.manage',
        ],
        user: { id: id(200), tenantId: id(201), displayName: '管理员', avatarUrl: null },
      },
    }),
  )
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, roles, users, organization, dictionary]) }),
  )
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({ json: defaultEffectiveBrand }),
  )
  await page.route('**/api/v1/iam/roles', (route) => route.fulfill({ json: { roles: [role] } }))
  await page.route('**/api/v1/iam/permissions', (route) =>
    route.fulfill({
      json: {
        permissions: [
          {
            code: 'iam.role.view',
            moduleId: 'iam',
            moduleName: '身份与权限',
            name: '查看角色',
            allowedScopeTypes: ['ALL'],
            dataScopeProvider: null,
          },
          {
            code: 'dictionary.view',
            moduleId: 'dictionary',
            moduleName: '数据字典',
            name: '查看数据字典',
            allowedScopeTypes: ['ALL'],
            dataScopeProvider: null,
          },
          {
            code: 'organization.view',
            moduleId: 'organization',
            moduleName: '组织与岗位',
            name: '查看组织',
            allowedScopeTypes: ['ALL', 'ORGANIZATION', 'CUSTOM'],
            dataScopeProvider: 'organization',
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/iam/roles/*/permissions', (route) =>
    route.fulfill({ json: { permissions: [] } }),
  )
  await page.route('**/api/v1/organization/scope-options', (route) =>
    route.fulfill({ json: { units: [] } }),
  )
  await page.route('**/api/v1/iam/users', (route) =>
    route.fulfill({
      json: {
        users: [
          {
            id: id(20),
            username: 'admin',
            displayName: '管理员',
            email: 'admin@example.com',
            phone: null,
            status: 'ACTIVE',
            lastLoginAt: now,
            createdAt: now,
            roleCount: 1,
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/iam/users/*/roles', (route) =>
    route.fulfill({
      json: { roles: [{ id: role.id, code: role.code, name: role.name, status: role.status }] },
    }),
  )
  await page.route('**/api/v1/organization/org-units', (route) =>
    route.fulfill({
      json: {
        units: [
          {
            id: id(30),
            parentId: null,
            code: 'HQ',
            name: '总部',
            type: 'COMPANY',
            status: 'ENABLED',
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: id(31),
            parentId: id(30),
            code: 'TECH',
            name: '技术部',
            type: 'DEPARTMENT',
            status: 'ENABLED',
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: id(32),
            parentId: id(31),
            code: 'DEV',
            name: '研发组',
            type: 'TEAM',
            status: 'DISABLED',
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/organization/org-units/*/positions', (route) =>
    route.fulfill({ json: { positions: [] } }),
  )
  await page.route('**/api/v1/organization/org-units/*/members', (route) =>
    route.fulfill({ json: { members: [] } }),
  )
  await page.route('**/api/v1/dictionary/catalog', (route) =>
    route.fulfill({
      json: {
        categories: [
          {
            id: id(40),
            code: 'common',
            name: '通用数据',
            sortOrder: 0,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          },
        ],
        types: [
          {
            id: id(41),
            categoryId: id(40),
            code: 'common.source',
            name: '来源类型',
            status: 'ENABLED',
            revision: 1,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/dictionary/types/*', (route) =>
    route.fulfill({
      json: {
        type: {
          id: id(41),
          categoryId: id(40),
          code: 'common.source',
          name: '来源类型',
          status: 'ENABLED',
          revision: 1,
          createdAt: now,
          updatedAt: now,
        },
        items: [],
      },
    }),
  )
})

test('role permissions stay within the selected module', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/iam/roles')
  const workspace = page.getByRole('heading', { name: '角色管理', exact: true }).locator('..')
  await expect(page.getByRole('heading', { name: '角色列表' })).toBeVisible()
  const listHeader = await page
    .getByRole('heading', { name: '角色列表' })
    .locator('xpath=ancestor::header')
    .boundingBox()
  const detailHeader = await page
    .getByRole('heading', { name: '租户管理员' })
    .locator('xpath=ancestor::header')
    .boundingBox()
  const workspaceBox = await workspace.boundingBox()
  if (listHeader === null || detailHeader === null || workspaceBox === null)
    throw new Error('角色工作区缺少头部')
  expect(Math.abs(listHeader.y - workspaceBox.y)).toBeLessThan(2)
  expect(Math.abs(listHeader.height - detailHeader.height)).toBeLessThan(2)
  expect(await workspace.evaluate((element) => getComputedStyle(element).borderWidth)).toBe('0px')
  const listPanel = workspace.locator('aside')
  const separator = page.getByRole('separator', { name: '调整列表与详情宽度' })
  const beforeResize = await listPanel.boundingBox()
  const separatorBox = await separator.boundingBox()
  if (beforeResize === null || separatorBox === null) throw new Error('工作区分割线不可见')
  const dragX = separatorBox.x + separatorBox.width / 2
  const dragY = separatorBox.y + separatorBox.height / 2
  await page.mouse.move(dragX, dragY)
  await page.mouse.down()
  await page.mouse.move(dragX + 100, dragY, { steps: 5 })
  await page.mouse.up()
  const afterDrag = await listPanel.boundingBox()
  if (afterDrag === null) throw new Error('列表面板不可见')
  expect(afterDrag.width).toBeGreaterThan(beforeResize.width + 50)
  await separator.focus()
  await page.keyboard.press('ArrowLeft')
  const afterKeyboard = await listPanel.boundingBox()
  if (afterKeyboard === null) throw new Error('列表面板不可见')
  expect(afterKeyboard.width).toBeLessThan(afterDrag.width)
  const searchButton = page.getByRole('button', { name: '搜索角色' })
  const createButton = page.getByRole('button', { name: '新建角色' })
  const searchButtonBox = await searchButton.boundingBox()
  const createButtonBox = await createButton.boundingBox()
  if (searchButtonBox === null || createButtonBox === null) throw new Error('列表操作按钮不可见')
  expect(Math.abs(searchButtonBox.width - createButtonBox.width)).toBeLessThan(1)
  expect(Math.abs(searchButtonBox.height - createButtonBox.height)).toBeLessThan(1)
  await searchButton.click()
  const searchField = page.getByRole('searchbox', { name: '搜索角色' })
  const searchRoot = searchField.locator('xpath=ancestor::*[@data-vean-input-root]')
  await expect(searchField).toBeFocused()
  await expect(searchRoot.getByRole('button')).toHaveCount(1)
  await expect(createButton).toHaveCount(0)
  await searchField.fill('租户')
  await expect(searchRoot.getByRole('button')).toHaveCount(1)
  await expect(searchRoot.getByRole('button', { name: '清空搜索' })).toBeVisible()
  await searchField.press('Escape')
  await expect(page.getByRole('button', { name: '新建角色' })).toBeVisible()
  await expect(searchField).toHaveCount(0)
  await searchButton.click()
  await expect(page.getByRole('searchbox', { name: '搜索角色' })).toHaveValue('租户')
  await searchRoot.getByRole('button', { name: '清空搜索' }).click()
  await expect(searchField).toHaveValue('')
  await expect(searchField).toBeFocused()
  await expect(searchRoot.getByRole('button')).toHaveCount(1)
  await page.getByRole('button', { name: '关闭搜索' }).click()
  await page.getByRole('button', { name: '新建角色' }).click()
  await expect(page.getByRole('heading', { name: '新建角色' })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await page.getByRole('button', { name: /租户管理员 tenant-administrator/ }).click()
  await page.getByRole('tab', { name: '功能权限' }).click()
  await expect(page.getByRole('navigation', { name: '权限模块' })).toBeVisible()
  await page
    .getByRole('navigation', { name: '权限模块' })
    .getByRole('button', { name: /数据字典/ })
    .click()
  await expect(page.getByText('dictionary.view')).toBeVisible()
  await expect(page.getByText('organization.view')).toHaveCount(0)
  const permissionSearch = page.getByRole('searchbox', { name: '搜索功能权限' })
  await permissionSearch.fill('organization')
  await expect(page.getByText('organization.view')).toBeVisible()
  await permissionSearch
    .locator('xpath=ancestor::*[@data-vean-input-root]')
    .locator('button[data-vean-input-clearable]')
    .click()
  await expect(permissionSearch).toHaveValue('')
})

test('small screens switch between the list and detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/iam/roles')
  await expect(page.getByRole('separator', { name: '调整列表与详情宽度' })).toBeHidden()
  await expect(page.getByRole('heading', { name: '角色列表' })).toBeVisible()
  await page.getByRole('button', { name: /租户管理员 tenant-administrator/ }).click()
  await expect(page.getByRole('heading', { name: '租户管理员' })).toBeVisible()
  await page.getByRole('button', { name: '返回列表' }).click()
  await expect(page.getByRole('heading', { name: '角色列表' })).toBeVisible()
})

test('user management separates profile, roles, and security', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/iam/users')
  await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toHaveText('用户管理')
  await expect(page.getByRole('heading', { name: '用户列表' })).toBeVisible()
  await page.getByRole('tab', { name: '角色分配' }).click()
  await expect(page.getByText('tenant-administrator')).toBeVisible()
})

test('inset management workspace fills the content region and follows viewport resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: {
        ...defaultEffectiveBrand,
        workspaceDefaults: { ...defaultEffectiveBrand.workspaceDefaults, sidebarVariant: 'inset' },
      },
    }),
  )
  await page.goto('/iam/users')
  const workspace = page.getByRole('heading', { name: '用户管理', exact: true }).locator('..')
  await expect(page.getByRole('heading', { name: '用户列表' })).toBeVisible()

  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1600, height: 1200 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expect
      .poll(() =>
        workspace.evaluate((element) => {
          const content = document.getElementById('workspace-content')
          if (!content) throw new Error('工作区内容区域缺失')
          const style = getComputedStyle(content)
          const availableHeight =
            content.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
          return Math.abs(element.getBoundingClientRect().height - availableHeight)
        }),
      )
      .toBeLessThan(2)
  }
})

test('long user lists scroll inside the workspace without moving the page header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.route('**/api/v1/iam/users', (route) =>
    route.fulfill({
      json: {
        users: Array.from({ length: 60 }, (_, index) => ({
          id: id(300 + index),
          username: `user${index}`,
          displayName: `用户 ${index}`,
          email: null,
          phone: null,
          status: 'ACTIVE',
          lastLoginAt: now,
          createdAt: now,
          roleCount: 1,
        })),
      },
    }),
  )
  await page.goto('/iam/users')
  const workspace = page.getByRole('heading', { name: '用户管理', exact: true }).locator('..')
  const list = workspace.locator('aside ul')
  await expect(list.getByRole('button')).toHaveCount(60)
  await expect
    .poll(() => list.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeGreaterThan(0)
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(
    list.getByRole('button', { name: '用户 59 user59 正常', exact: true }),
  ).toBeInViewport()
  await expect(page.getByRole('heading', { name: '用户列表' })).toBeInViewport()
  await expect
    .poll(() =>
      page.locator('#workspace-content').evaluate((element) => ({
        scrollTop: element.scrollTop,
        overflow: element.scrollHeight - element.clientHeight,
      })),
    )
    .toEqual({ scrollTop: 0, overflow: 0 })
})

test('organization management keeps the tree and detail in one workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/organization/units')
  await expect(page.getByRole('heading', { name: '组织架构', exact: true })).toHaveText('组织架构')
  await expect(page.getByRole('heading', { name: '组织树' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建根组织' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '总部' })).toBeVisible()
})

test('dictionary management keeps type actions in the detail', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/dictionary/entries')
  await expect(page.getByRole('heading', { name: '数据字典', exact: true })).toHaveText('数据字典')
  await expect(page.getByRole('heading', { name: '字典目录' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建分类' })).toBeVisible()
  await page.getByRole('treeitem', { name: /来源类型/ }).click()
  await expect(page.getByRole('heading', { name: '来源类型' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建条目' })).toHaveCount(1)
})

test('organization tree separates selection, keyboard expansion, search and node actions', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/organization/units')
  const tree = page.getByRole('tree', { name: '组织架构', exact: true })
  const headquarters = tree.getByRole('treeitem', { name: /总部/ })
  await page.getByRole('button', { name: '全部折叠', exact: true }).click()
  await expect(headquarters).toHaveAttribute('aria-expanded', 'false')
  await headquarters.click()
  await expect(headquarters).toHaveAttribute('aria-selected', 'true')
  await expect(headquarters).toHaveAttribute('aria-expanded', 'false')
  await headquarters.focus()
  await page.keyboard.press('ArrowRight')
  await expect(headquarters).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowRight')
  const department = tree.getByRole('treeitem', { name: /技术部/ })
  await expect(department).toBeFocused()
  await expect(tree.locator('[data-vean-tree-motion]')).toHaveCount(0)
  await expect(department).toBeFocused()
  await expect(department.getByRole('button', { name: '新建下级组织' })).toHaveCSS('opacity', '1')
  await page.keyboard.press('ArrowRight')
  await expect(department).toHaveAttribute('aria-expanded', 'true')
  await expect(department).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const team = tree.getByRole('treeitem', { name: /研发组/ })
  await expect(team).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(team).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: '研发组', exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('organization-tree.png'),
    animations: 'disabled',
  })
  await page.keyboard.press('ArrowLeft')
  await expect(department).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(department).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: '全部折叠', exact: true }).click()
  await page.getByRole('button', { name: '搜索组织', exact: true }).click()
  const search = page.getByRole('searchbox', { name: '搜索组织' })
  await search.fill('DEV')
  await expect(team).toBeVisible()
  await search.fill('')
  await expect(headquarters).toHaveAttribute('aria-expanded', 'false')
  await expect(team).toHaveCount(0)
  await headquarters.getByRole('button', { name: '新建下级组织' }).click()
  await expect(page.getByRole('heading', { name: '新建组织', exact: true })).toBeVisible()
  await expect(headquarters).toHaveAttribute('aria-selected', 'false')
})

test('dictionary tree supports keyboard expansion and preserves selection on category actions', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/dictionary/entries')
  const tree = page.getByRole('tree', { name: '字典目录', exact: true })
  const category = tree.getByRole('treeitem', { name: /通用数据/ })
  await page.getByRole('button', { name: '全部折叠', exact: true }).click()
  await category.click()
  await expect(category).toHaveAttribute('aria-selected', 'true')
  await expect(category).toHaveAttribute('aria-expanded', 'false')
  await category.focus()
  await page.keyboard.press('ArrowRight')
  await expect(category).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowRight')
  const type = tree.getByRole('treeitem', { name: /来源类型/ })
  await expect(type).toBeFocused()
  await page.keyboard.press('Space')
  await expect(type).toHaveAttribute('aria-selected', 'true')
  await expect(category).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByRole('heading', { name: '来源类型', exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('dictionary-tree.png'),
    animations: 'disabled',
  })
  await category.getByRole('button', { name: '在分类下新建类型' }).click()
  await expect(page.getByRole('heading', { name: '新建字典类型', exact: true })).toBeVisible()
  await expect(type).toHaveAttribute('aria-selected', 'true')
  await expect(category.getByRole('button', { name: '删除分类' })).toBeDisabled()
  await page.getByRole('button', { name: '全部折叠', exact: true }).click()
  await page.getByRole('button', { name: '搜索字典目录', exact: true }).click()
  const search = page.getByRole('searchbox', { name: '搜索字典目录' })
  await search.fill('common.source')
  await expect(type).toBeVisible()
  await search.fill('')
  await expect(category).toHaveAttribute('aria-expanded', 'false')
  await expect(type).toHaveCount(0)
})
