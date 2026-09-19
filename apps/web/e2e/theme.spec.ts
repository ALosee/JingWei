import { expect, test } from '@playwright/test'

import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'
import { THEME_STORAGE_KEY as storageKey } from '@jingwei/ui/theme-init'

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
  icon: 'user',
  params: { id: 'me' },
}
const response = (nodes: NavigationNode[]): NavigationResponse => ({
  schemaVersion: 2,
  versionId: id(100),
  publishedRevision: 1,
  authEntryCode: login.code,
  homeCode: account.code,
  nodes,
})

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ json: response([login]) }),
  )
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        permissions: [],
        user: {
          id: id(200),
          tenantId: id(201),
          displayName: '管理员',
          avatarUrl: null,
        },
      },
    }),
  )
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, account]) }),
  )
})

test('theme settings use a non-modal popover and persist across reloads', async ({ page }) => {
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const panel = page.getByRole('dialog', { name: '工作区设置' })
  await expect(panel).toBeVisible()
  await expect(page.locator('[data-soybean-dialog-overlay]')).toHaveCount(0)
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  // ThemeCustomizer 内的 Select 浮层可能仍持有 dismiss 焦点，先点到面板外再 Escape
  await page.mouse.click(8, 8)
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('#__SoybeanUI_theme')).toHaveCount(1)
})

test('restores palette, radius and global size and follows system changes', async ({ page }) => {
  await page.goto('/account/me')
  const defaultPrimary = await page
    .locator('html')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--primary'))
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ base: 'stone', primary: 'rose', radius: 'xl', size: 'lg', mode: 'auto' }),
      )
    },
    { key: storageKey },
  )
  await page.goto('/account/me')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('font-size', '18px')
  await expect(page.getByRole('button', { name: '工作区设置', exact: true })).toHaveCSS(
    'border-radius',
    '13.75px',
  )
  const restoredPrimary = await page
    .locator('html')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--primary'))
  expect(restoredPrimary).not.toBe(defaultPrimary)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('login brand canvas follows the active primary palette', async ({ page }) => {
  await page.unroute('**/api/v1/iam/session')
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({ json: { authenticated: false } }),
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/signin')

  const canvas = page.locator('section[aria-labelledby="platform-title"]')
  await expect(canvas).toBeVisible()
  const defaultBackground = await canvas.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )
  await page
    .locator('main')
    .evaluate((element) => element.style.setProperty('--primary', '0 72% 50%'))
  await expect
    .poll(() => canvas.evaluate((element) => getComputedStyle(element).backgroundImage))
    .not.toBe(defaultBackground)
})

test('invalid persisted theme falls back to a usable settings panel', async ({ page }) => {
  await page.addInitScript(({ key }) => localStorage.setItem(key, '{broken'), { key: storageKey })
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '工作区设置' })).toBeVisible()
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
})

test('mobile settings stay within viewport and reset persisted preferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const resetButton = page.getByRole('button', { name: '重置', exact: true })
  await resetButton.scrollIntoViewIfNeeded()
  await resetButton.click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  const panel = await page.getByRole('dialog', { name: '工作区设置' }).boundingBox()
  if (!panel) throw new Error('Settings panel has no visible bounds')
  expect(panel.x).toBeGreaterThanOrEqual(0)
  expect(panel.x + panel.width).toBeLessThanOrEqual(390)
  await page.mouse.click(8, 8)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '工作区设置' })).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('layout mode, dimensions and tab visibility persist', async ({ page }) => {
  await page.goto('/account/me')
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '页面标签' })).toBeVisible()
  await expect(page.getByText('管理员', { exact: true })).toBeVisible()
  const layoutRoot = page.locator('[data-soybean-layout-root]')
  await page.getByRole('button', { name: '切换侧边栏' }).click()
  await expect(layoutRoot).toHaveAttribute('data-state', 'collapsed')
  await page.getByRole('button', { name: '切换侧边栏' }).click()
  await expect(layoutRoot).toHaveAttribute('data-state', 'expanded')

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '布局设置' }).click()
  const headerHeight = page.getByRole('spinbutton', { name: 'Header 高度' })
  const siderWidth = page.getByRole('spinbutton', { name: 'Sider 宽度' })
  await headerHeight.fill('80')
  await headerHeight.press('Tab')
  await siderWidth.fill('288')
  await siderWidth.press('Tab')
  await expect(page.locator('[data-soybean-layout-header]')).toHaveCSS('height', '80px')
  await expect(page.locator('[data-soybean-layout-sidebar] > div:nth-child(2)')).toHaveCSS(
    'width',
    '288px',
  )
  await page.getByRole('radio', { name: '顶部菜单模式' }).click()
  await page.getByRole('switch', { name: /显示页面标签/u }).click()
  await expect(page.getByRole('navigation', { name: '顶部导航' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '页面标签' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '经纬企业平台首页' })).toHaveCount(1)

  await page.reload()
  await expect(page.getByRole('navigation', { name: '顶部导航' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '页面标签' })).toHaveCount(0)
})

test('custom brand mark keeps its original transparent presentation', async ({ page }) => {
  await page.route('**/api/v1/iam/account', (route) =>
    route.fulfill({
      json: {
        id: id(200),
        username: 'admin',
        displayName: '管理员',
        email: null,
        phone: null,
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordChangedAt: '2026-01-01T00:00:00.000Z',
      },
    }),
  )
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 2,
        source: 'PUBLISHED',
        publishedRevision: 1,
        systemName: '智能审核平台',
        shortName: '审核平台',
        loginTitle: '智能审核平台',
        loginTagline: '',
        titleMode: 'PAGE_AND_SYSTEM',
        horizontalBrandMode: 'SHORT_NAME',
        logoColorMode: 'ORIGINAL',
        logoUrl: null,
        logoContentType: null,
        markUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lbMcWQAAAABJRU5ErkJggg==',
        markContentType: 'image/png',
        faviconUrl: null,
        faviconContentType: null,
      },
    }),
  )

  await page.goto('/account/me')
  const frame = page.locator('[data-global-brand-mark]').first()
  await expect(frame).toHaveAttribute('data-brand-mark-source', 'custom')
  await expect(frame).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(frame).toHaveCSS('border-radius', '0px')
  await expect(frame).toHaveCSS('box-shadow', 'none')
  await expect(frame.locator('img')).toHaveCSS('object-fit', 'contain')
})

test('chrome page tabs keep both corner arcs connected to the active tab background', async ({
  page,
}) => {
  await page.goto('/account/me')
  const activeTab = page.locator('[data-soybean-page-tabs-item][data-active="true"]')
  await expect(activeTab).toBeVisible()

  const colors = await activeTab.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    corners: [...element.querySelectorAll(':scope > svg')].map(
      (corner) => getComputedStyle(corner).fill,
    ),
  }))

  expect(colors.corners).toHaveLength(2)
  expect(colors.corners).toEqual([colors.background, colors.background])
})

test('layout region boundaries are drawn by a single owning layer', async ({ page }) => {
  await page.goto('/account/me')
  const sidebarWrapper = page.locator('[data-soybean-layout-sidebar] > div:nth-child(2)')
  const sidebar = page.locator('[data-sidebar="sidebar"]')
  const header = page.locator('[data-soybean-layout-header]')
  const tabs = page.getByRole('navigation', { name: '页面标签' })

  await expect(sidebarWrapper).toHaveCSS('border-inline-end-width', '1px')
  await expect(sidebar).toHaveCSS('border-inline-end-width', '0px')
  await expect(header).toHaveCSS('border-bottom-width', '1px')
  await expect(tabs).toHaveCSS('border-top-width', '0px')
  await expect(tabs).toHaveCSS('border-bottom-width', '1px')
})

test('brand keeps distinct header and sider behavior', async ({ page }) => {
  await page.goto('/account/me')
  const sidebarWrapper = page.locator('[data-soybean-layout-sidebar] > div:nth-child(2)')
  const headerBrandRegion = page.locator('[data-global-brand-region="header"]')
  const headerBrandLink = headerBrandRegion.getByRole('link', {
    name: '经纬企业平台首页',
  })

  await expect(headerBrandRegion).toBeVisible()
  await expect(headerBrandRegion).toHaveCSS('border-inline-end-width', '0px')
  await expect
    .poll(async () => {
      const sidebarBox = await sidebarWrapper.boundingBox()
      const brandBox = await headerBrandRegion.boundingBox()
      if (!sidebarBox || !brandBox) return Number.POSITIVE_INFINITY
      return Math.abs(sidebarBox.width - brandBox.width)
    })
    .toBeLessThanOrEqual(1)
  const expandedBrandWidth = await headerBrandRegion.evaluate((element) => element.clientWidth)

  await page.getByRole('button', { name: '切换侧边栏' }).click()
  await expect(page.locator('[data-soybean-layout-root]')).toHaveAttribute(
    'data-state',
    'collapsed',
  )
  await expect(headerBrandLink.locator('[data-global-brand-wordmark]')).toBeVisible()
  await expect
    .poll(async () => headerBrandRegion.evaluate((element) => element.clientWidth))
    .toBe(expandedBrandWidth)
  await page.getByRole('button', { name: '切换侧边栏' }).click()

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '布局设置' }).click()
  await page.getByRole('tab', { name: '侧栏', exact: true }).click()

  const siderBrandRegion = page.locator('[data-global-brand-region="sider"]')
  await expect(siderBrandRegion).toBeVisible()
  await expect(headerBrandRegion).toHaveCount(0)
})

test('collapsed tree menu aligns active and hover surfaces in the sider', async ({ page }) => {
  await page.goto('/account/me')
  await page.getByRole('button', { name: '切换侧边栏' }).click()

  const layoutRoot = page.locator('[data-soybean-layout-root]')
  const sider = page.locator('[data-sidebar="sidebar"]')
  const accountItem = page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '个人账号' })
  const hoverSurface = accountItem.locator('xpath=ancestor::*[@data-soybean-tree-menu-item][1]')

  await expect(layoutRoot).toHaveAttribute('data-state', 'collapsed')
  await expect(accountItem).toBeVisible()
  await expect
    .poll(async () => {
      const siderBox = await sider.boundingBox()
      const itemBox = await accountItem.boundingBox()
      if (!siderBox || !itemBox) return Number.POSITIVE_INFINITY

      const siderCenter = siderBox.x + siderBox.width / 2
      const itemCenter = itemBox.x + itemBox.width / 2
      return Math.abs(siderCenter - itemCenter)
    })
    .toBeLessThanOrEqual(1)
  await expect
    .poll(async () => {
      const activeBox = await accountItem.boundingBox()
      const hoverBox = await hoverSurface.boundingBox()
      if (!activeBox || !hoverBox) return Number.POSITIVE_INFINITY

      return Math.abs(activeBox.width - hoverBox.width)
    })
    .toBeLessThanOrEqual(1)
})

test('toolbar searches visible menus and uses the browser fullscreen state', async ({ page }) => {
  await page.goto('/account/me')
  await page.getByRole('button', { name: '菜单搜索' }).click()
  const search = page.getByRole('dialog', { name: '菜单搜索' })
  await search.getByRole('searchbox', { name: '搜索菜单' }).fill('个人')
  await expect(search.getByRole('link', { name: '个人账号' })).toBeVisible()

  const fullscreen = page.getByRole('button', { name: '进入全屏' })
  if (await fullscreen.isEnabled()) {
    await fullscreen.click()
    await expect(page.getByRole('button', { name: '退出全屏' })).toBeVisible()
    await page.getByRole('button', { name: '退出全屏' }).click()
    await expect(page.getByRole('button', { name: '进入全屏' })).toBeVisible()
  }
})

test('content scroll does not move the header', async ({ page }) => {
  await page.goto('/account/me')
  const header = page.locator('[data-soybean-layout-header]')
  const content = page.locator('[data-soybean-layout-content]')
  const before = await header.boundingBox()
  await content.evaluate((element) => {
    const spacer = document.createElement('div')
    spacer.style.height = '2000px'
    element.append(spacer)
    element.scrollTop = 900
  })
  const after = await header.boundingBox()
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(after?.y).toBe(before?.y)
})

test('left layout places a header brand above both sider and content', async ({ page }) => {
  await page.goto('/account/me')
  const root = page.locator('[data-soybean-layout-root]')
  const header = page.locator('[data-soybean-layout-header]')
  const sider = page.locator('[data-sidebar="sidebar"]')
  const content = page.locator('[data-soybean-layout-content]')

  await expect(root).toHaveAttribute('data-orientation', 'vertical')
  const headerBox = await header.boundingBox()
  const siderBox = await sider.boundingBox()
  const contentBox = await content.boundingBox()
  if (!headerBox || !siderBox || !contentBox) throw new Error('Layout regions have no bounds')
  expect(headerBox.x).toBeLessThan(1)
  expect(headerBox.width).toBeGreaterThanOrEqual(1279)
  expect(siderBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
  expect(contentBox.x).toBeGreaterThanOrEqual(siderBox.x + siderBox.width - 1)

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '布局设置' }).click()
  await page.getByRole('tab', { name: '侧栏', exact: true }).click()
  await expect(root).toHaveAttribute('data-orientation', 'horizontal')

  const shiftedHeaderBox = await header.boundingBox()
  const fullHeightSiderBox = await sider.boundingBox()
  if (!shiftedHeaderBox || !fullHeightSiderBox)
    throw new Error('Shifted layout regions have no bounds')
  expect(fullHeightSiderBox.y).toBeLessThan(1)
  await expect
    .poll(async () => (await header.boundingBox())?.x ?? -1)
    .toBeGreaterThanOrEqual(fullHeightSiderBox.x + fullHeightSiderBox.width - 1)
})
