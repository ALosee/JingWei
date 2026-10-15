import { expect, test, type Page } from '@playwright/test'

import { defaultEffectiveBrand, workspaceLayoutModes } from '@jingwei/module-branding/shared'
import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'

const id = (value: number) => '00000000-0000-7000-8000-' + String(value).padStart(12, '0')
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
const account: NavigationNode = {
  ...login,
  id: id(2),
  code: 'iam.account',
  name: '个人账号',
  type: 'MENU',
  routeKey: 'iam.account',
  path: '/account/:id',
  layout: 'base',
  accessMode: 'AUTHENTICATED',
  params: { id: 'me' },
  query: { tab: 'profile' },
}
const roles: NavigationNode = {
  ...account,
  id: id(3),
  code: 'iam.roles',
  name: '角色权限',
  routeKey: 'iam.roles',
  path: '/roles',
  accessMode: 'PERMISSION',
  params: {},
  query: {},
}
const response = (nodes: NavigationNode[]): NavigationResponse => ({
  schemaVersion: 2,
  versionId: id(100),
  publishedRevision: 1,
  authEntryCode: login.code,
  homeCode: account.code,
  nodes,
})

async function mockWorkspaceApis(page: Page) {
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ json: response([login]) }),
  )
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, account, roles]) }),
  )
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        permissions: [],
        user: { id: id(200), tenantId: id(201), displayName: '管理员', avatarUrl: null },
      },
    }),
  )
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({ json: defaultEffectiveBrand }),
  )
  await page.route('**/api/v1/iam/account', (route) =>
    route.fulfill({
      json: {
        id: id(200),
        username: 'admin',
        displayName: '管理员',
        email: null,
        phone: null,
        avatarUrl: null,
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordChangedAt: '2026-01-01T00:00:00.000Z',
      },
    }),
  )
  await page.route('**/api/v1/iam/roles', (route) => route.fulfill({ json: { roles: [] } }))
  await page.route('**/api/v1/iam/permissions', (route) =>
    route.fulfill({ json: { permissions: [] } }),
  )
}

test.beforeEach(async ({ page }) => mockWorkspaceApis(page))

function tab(page: Page, path: string) {
  return page.locator(`[data-vean-page-tabs-item][data-value="${path}"]`)
}

async function visit(page: Page, path: string) {
  // Exercise Router's browser-history listener without reloading the shell.
  await page.evaluate((target) => {
    window.history.pushState({}, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(tab(page, path.split(/[?#]/)[0] ?? path)).toHaveAttribute('data-selected', 'true')
}

async function selectMenu(page: Page, path: string, label: string) {
  await tab(page, path).click({ button: 'right' })
  await page.getByRole('menuitem', { name: label, exact: true }).click()
  await expect(page.locator('[data-vean-menu-content]')).toHaveCount(0)
}

async function expectOrder(page: Page, paths: string[]) {
  await expect
    .poll(() =>
      page
        .locator('[data-vean-page-tabs-item]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-value'))),
    )
    .toEqual(paths)
}

test('deep links include a permanent home and all context actions respect pinning', async ({
  page,
}) => {
  await page.goto('/roles')
  await expectOrder(page, ['/account/me', '/roles'])
  const homeTab = tab(page, '/account/me')
  await expect(homeTab.locator('[data-vean-page-tabs-close]')).toHaveCount(0)
  await expect(homeTab).toHaveAttribute('data-draggable', 'false')
  await homeTab.click({ button: 'middle' })
  await homeTab.focus()
  await page.keyboard.press('Backspace')
  await expectOrder(page, ['/account/me', '/roles'])
  await homeTab.click({ button: 'right' })
  for (const name of ['关闭', '关闭其他', '关闭左侧', '关闭右侧', '关闭所有', '取消固定']) {
    await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('menuitem', { name: '关闭', exact: true })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: '取消固定', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await selectMenu(page, '/roles', '固定')
  await expect(tab(page, '/roles').locator('[data-vean-page-tabs-close]')).toHaveCount(0)
  await visit(page, '/account/me?tab=security#details')
  await visit(page, '/roles')
  await expect(tab(page, '/roles').locator('[data-vean-page-tabs-close]')).toHaveCount(0)
  await visit(page, '/account/other')
  await selectMenu(page, '/account/other', '关闭所有')
  await expectOrder(page, ['/account/me', '/roles'])
  await expect(page).toHaveURL(/\/roles$/)
  await selectMenu(page, '/roles', '取消固定')
  await expect(tab(page, '/roles').locator('[data-vean-page-tabs-close]')).toHaveCount(1)
  await selectMenu(page, '/roles', '关闭')
  await expectOrder(page, ['/account/me'])
  await expect(page).toHaveURL(/\/account\/me\?tab=security#details$/)
})

test('close left, right and other use the displayed order and keep the home', async ({ page }) => {
  await page.goto('/roles')
  await expect(tab(page, '/roles')).toHaveAttribute('data-selected', 'true')
  await visit(page, '/account/a')
  await visit(page, '/account/b')
  await selectMenu(page, '/account/a', '关闭左侧')
  await expectOrder(page, ['/account/me', '/account/a', '/account/b'])
  await selectMenu(page, '/account/a', '关闭右侧')
  await expectOrder(page, ['/account/me', '/account/a'])
  await expect(page).toHaveURL(/\/account\/a$/)
  await visit(page, '/roles')
  await visit(page, '/account/b')
  await selectMenu(page, '/roles', '关闭其他')
  await expectOrder(page, ['/account/me', '/roles'])
  await expect(page).toHaveURL(/\/roles$/)
})

test('native mouse and keyboard dragging reorder within zones and cannot pass the home', async ({
  page,
}) => {
  await page.goto('/roles')
  await expect(tab(page, '/roles')).toHaveAttribute('data-selected', 'true')
  await visit(page, '/account/a')
  await visit(page, '/account/b')
  const source = await tab(page, '/account/b').boundingBox()
  const target = await tab(page, '/roles').boundingBox()
  if (!source || !target) throw new Error('Tab drag bounds are missing')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + 4, target.y + target.height / 2, { steps: 12 })
  await page.mouse.up()
  await expectOrder(page, ['/account/me', '/account/b', '/roles', '/account/a'])
  await tab(page, '/account/a').focus()
  await page.keyboard.press('Space')
  await expect(tab(page, '/account/a')).toHaveAttribute('data-dragging', 'true')
  await page.keyboard.press('Home')
  await expectOrder(page, ['/account/me', '/account/a', '/account/b', '/roles'])
  await expect(tab(page, '/account/a')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(tab(page, '/account/a')).toHaveAttribute('data-dragging', 'false')
  await expectOrder(page, ['/account/me', '/account/a', '/account/b', '/roles'])
  await selectMenu(page, '/roles', '固定')
  await expectOrder(page, ['/account/me', '/roles', '/account/a', '/account/b'])
  await tab(page, '/account/b').focus()
  await expect(tab(page, '/account/b')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(tab(page, '/account/b')).toHaveAttribute('data-dragging', 'true')
  await page.keyboard.press('Home')
  await expectOrder(page, ['/account/me', '/roles', '/account/b', '/account/a'])
  await page.keyboard.press('Enter')
  await expectOrder(page, ['/account/me', '/roles', '/account/b', '/account/a'])
})

test('overflow controls stay on the right and edge fades follow the scroll position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 720 })
  await page.goto('/roles')
  for (let index = 0; index < 10; index++) await visit(page, `/account/${index}`)
  const scroller = page.locator('[data-vean-page-tabs-root]')
  const viewport = scroller.locator('..')
  const left = page.getByRole('button', { name: '向左滚动标签' })
  const right = page.getByRole('button', { name: '向右滚动标签' })
  await expect(left).toBeVisible()
  await expect(right).toBeVisible()
  await expect(right).toBeDisabled()
  const viewportBounds = await viewport.boundingBox()
  const leftBounds = await left.boundingBox()
  const rightBounds = await right.boundingBox()
  if (!viewportBounds || !leftBounds || !rightBounds) throw new Error('Tab bounds are missing')
  expect(leftBounds.x).toBeGreaterThanOrEqual(viewportBounds.x + viewportBounds.width)
  expect(rightBounds.x).toBeGreaterThanOrEqual(leftBounds.x + leftBounds.width)
  await expect(viewport).toHaveCSS(
    'mask-image',
    /^linear-gradient\(to right, rgba\(0, 0, 0, 0\), .*, rgb\(0, 0, 0\)\)$/,
  )
  const end = await scroller.evaluate((element) => element.scrollLeft)
  await left.click()
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollLeft))
    .toBeLessThan(end - 100)
  await expect(right).toBeEnabled()
  await expect(viewport).toHaveCSS(
    'mask-image',
    /^linear-gradient\(to right, rgba\(0, 0, 0, 0\), .*, rgba\(0, 0, 0, 0\)\)$/,
  )
  await page.screenshot({ path: '/tmp/jingwei-workspace-tabs-overflow-middle.png' })
  await right.click()
  await expect(right).toBeDisabled()
  await expect(page.getByRole('button', { name: '刷新当前页面' })).toBeInViewport()
  await expect(page.getByRole('button', { name: '进入页面全屏' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: '/tmp/jingwei-workspace-tabs-overflow.png' })
  await scroller.evaluate((element) => {
    element.scrollLeft = 0
  })
  await expect(left).toBeDisabled()
  await expect(right).toBeEnabled()
  await expect(viewport).toHaveCSS(
    'mask-image',
    /^linear-gradient\(to right, rgb\(0, 0, 0\), .*, rgba\(0, 0, 0, 0\)\)$/,
  )
  await page.screenshot({ path: '/tmp/jingwei-workspace-tabs-overflow-start.png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: '/tmp/jingwei-workspace-tabs-overflow-dark.png' })
  await page.setViewportSize({ width: 1920, height: 720 })
  await expect(left).toHaveCount(0)
  await expect(right).toHaveCount(0)
  await expect(viewport).toHaveCSS('mask-image', 'none')
  await page.setViewportSize({ width: 640, height: 720 })
  await expect(left).toBeVisible()
  await expect(right).toBeVisible()
  await selectMenu(page, '/account/9', '关闭所有')
  await expectOrder(page, ['/account/me'])
  await expect(left).toHaveCount(0)
  await expect(right).toHaveCount(0)
  await expect(viewport).toHaveCSS('mask-image', 'none')
})

test('refresh reloads only the current page while preserving the URL, pins and tab order', async ({
  page,
}) => {
  let requests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/iam/account') requests++
  })
  await page.goto('/roles')
  await selectMenu(page, '/roles', '固定')
  await visit(page, '/account/me?tab=security#details')
  await expect.poll(() => requests).toBe(1)
  await page.getByRole('button', { name: '刷新当前页面' }).click()
  await expect.poll(() => requests).toBe(2)
  await expect(page).toHaveURL(/\/account\/me\?tab=security#details$/)
  await expectOrder(page, ['/account/me', '/roles'])
  await expect(tab(page, '/roles').locator('[data-vean-page-tabs-close]')).toHaveCount(0)
})

test('browser reload restores order, fixed tabs and query/hash without reopening closed tabs', async ({
  page,
}) => {
  await page.goto('/roles')
  await expect(tab(page, '/roles')).toHaveAttribute('data-selected', 'true')
  await visit(page, '/account/a?section=last#details')
  await visit(page, '/account/b')
  await selectMenu(page, '/roles', '固定')
  await tab(page, '/account/b').focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('Home')
  await expectOrder(page, ['/account/me', '/roles', '/account/b', '/account/a'])
  await page.keyboard.press('Enter')
  await visit(page, '/account/me?section=current#active')
  await page.reload()
  await expectOrder(page, ['/account/me', '/roles', '/account/b', '/account/a'])
  await expect(tab(page, '/roles').locator('[data-vean-page-tabs-close]')).toHaveCount(0)
  await expect(tab(page, '/account/me')).toHaveAttribute('data-selected', 'true')
  await expect(page).toHaveURL(/\/account\/me\?section=current#active$/)
  await tab(page, '/account/a').click()
  await expect(page).toHaveURL(/\/account\/a\?section=last#details$/)
  await tab(page, '/account/a').locator('[data-vean-page-tabs-close]').click()
  await expectOrder(page, ['/account/me', '/roles', '/account/b'])
  await page.reload()
  await expectOrder(page, ['/account/me', '/roles', '/account/b'])
})

test('a new navigation version discards revoked tabs and uses current titles', async ({ page }) => {
  await page.goto('/roles')
  await expect(tab(page, '/roles')).toHaveAttribute('data-selected', 'true')
  await visit(page, '/account/a')
  await page.unroute('**/api/v1/navigation/me')
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({
      json: {
        ...response([login, { ...account, name: '我的账号' }]),
        publishedRevision: 2,
        versionId: id(101),
      },
    }),
  )
  await page.reload()
  await expectOrder(page, ['/account/me', '/account/a'])
  await expect(tab(page, '/account/a')).toContainText('我的账号')
  await expect(tab(page, '/account/me').locator('[data-vean-page-tabs-close]')).toHaveCount(0)
})

test('browser tabs and signed-in users keep separate workspace sessions', async ({ page }) => {
  await page.goto('/roles')
  await expect(tab(page, '/roles')).toHaveAttribute('data-selected', 'true')
  await visit(page, '/account/me')
  const other = await page.context().newPage()
  await mockWorkspaceApis(other)
  await other.goto('/account/me')
  await expectOrder(other, ['/account/me'])
  await other.close()
  await page.reload()
  await expectOrder(page, ['/account/me', '/roles'])
  await page.unroute('**/api/v1/iam/session')
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        permissions: [],
        user: { id: id(202), tenantId: id(201), displayName: '另一位用户', avatarUrl: null },
      },
    }),
  )
  await page.reload()
  await expectOrder(page, ['/account/me'])
})

for (const mode of workspaceLayoutModes) {
  test(`page fullscreen hides chrome and restores ${mode} without remounting the page`, async ({
    page,
  }) => {
    await page.unroute('**/api/v1/branding/bootstrap*')
    await page.route('**/api/v1/branding/bootstrap*', (route) =>
      route.fulfill({
        json: {
          ...defaultEffectiveBrand,
          workspaceDefaults: {
            ...defaultEffectiveBrand.workspaceDefaults,
            layoutMode: mode,
            sidebarVariant: 'inset',
          },
        },
      }),
    )
    let requests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/v1/iam/account') requests++
    })
    await page.goto('/account/me')
    await expect.poll(() => requests).toBe(1)
    const shell = page.locator('[data-vean-app-shell]')
    const header = page.locator('[data-vean-layout-header]')
    const sidebar = page.locator('[data-vean-layout-sidebar]')
    const originalMode = await shell.getAttribute('data-mode')
    await page.getByRole('button', { name: '进入页面全屏' }).click()
    await expect(shell).toHaveAttribute('data-full-content', 'true')
    await expect(header).toHaveCount(0)
    await expect(sidebar).toBeHidden()
    await expect(page.getByRole('button', { name: '退出页面全屏' })).toBeVisible()
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true)
    const tabs = page.locator('[data-vean-layout-tab]')
    await expect.poll(async () => (await tabs.boundingBox())?.y).toBe(0)
    const bounds = await tabs.boundingBox()
    expect(bounds?.x).toBe(0)
    expect(bounds?.width).toBe(1280)
    if (mode === 'left')
      await page.screenshot({ path: '/tmp/jingwei-workspace-tabs-fullscreen.png' })
    await page.getByRole('button', { name: '退出页面全屏' }).click()
    await expect(shell).toHaveAttribute('data-full-content', 'false')
    await expect(shell).toHaveAttribute('data-mode', originalMode ?? '')
    await expect(header).toBeVisible()
    expect(requests).toBe(1)
  })
}
