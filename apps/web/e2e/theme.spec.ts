import { expect, test } from '@playwright/test'

import {
  defaultBrandConfiguration,
  defaultEffectiveBrand,
  type BrandAdmin,
  type BrandVersion,
  type EffectiveBrand,
} from '@jingwei/module-branding/shared'
import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'
import { THEME_STORAGE_KEY as storageKey } from '@jingwei/ui/theme-init'
import { generateThemePaletteColors } from '@jingwei/ui/theme-palette'

import { appearancePreferenceStorageKey } from '../src/stores/appearance.js'

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
const branding: NavigationNode = {
  ...account,
  id: id(3),
  code: 'branding.manage',
  name: '品牌定制',
  routeKey: 'branding.manage',
  path: '/branding/manage',
  accessMode: 'PERMISSION',
  params: {},
}
const response = (nodes: NavigationNode[]): NavigationResponse => ({
  schemaVersion: 2,
  versionId: id(100),
  publishedRevision: 1,
  authEntryCode: login.code,
  homeCode: account.code,
  nodes,
})
const publishedBrand = (overrides: Partial<EffectiveBrand> = {}): EffectiveBrand => ({
  ...defaultEffectiveBrand,
  source: 'PUBLISHED',
  publishedRevision: 1,
  ...overrides,
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
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, account]) }),
  )
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({ json: defaultEffectiveBrand }),
  )
})

test('appearance settings use a non-modal popover and persist across reloads', async ({ page }) => {
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const panel = page.getByRole('dialog', { name: '工作区设置' })
  await expect(panel).toBeVisible()
  await expect(page.locator('[data-soybean-dialog-overlay]')).toHaveCount(0)
  await expect(panel.getByRole('tab', { name: '外观设置' })).toHaveCSS('border-bottom-width', '2px')
  await expect(panel.getByRole('tab', { name: '浅色' })).toHaveCSS('border-bottom-width', '0px')
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.mouse.click(8, 8)
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('#__SoybeanUI_theme')).toHaveCount(1)
})

test('tenant theme ignores unscoped legacy colors, size and mode', async ({ page }) => {
  let brand = publishedBrand({
    visualTheme: {
      ...defaultEffectiveBrand.visualTheme,
      basePalette: 'stone',
      primaryPalette: 'rose',
      radius: 'xl',
      sidebarScheme: 'contrast',
    },
  })
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) => route.fulfill({ json: brand }))
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ base: 'gray', primary: 'blue', radius: '2xs', size: 'lg', mode: 'auto' }),
      )
    },
    { key: storageKey },
  )
  await page.goto('/account/me')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
  await expect
    .poll(() =>
      page
        .locator('html')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--radius').trim()),
    )
    .toBe('0.875rem')
  const tenantPrimary = await page
    .locator('html')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--primary'))
  brand = publishedBrand()
  await page.reload()
  const defaultPrimary = await page
    .locator('html')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--primary'))
  expect(tenantPrimary).not.toBe(defaultPrimary)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('published tenant ramps drive independent light and dark page and card surfaces', async ({
  page,
}) => {
  const colors = generateThemePaletteColors('#75839a')
  const brand = publishedBrand({
    visualTheme: {
      ...defaultEffectiveBrand.visualTheme,
      customBasePalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '租户中性色',
        seedColor: '#75839a',
        colors,
      },
      overrides: {
        light: {
          background: { kind: 'PALETTE', palette: 'BASE', level: 100 },
          card: { kind: 'PALETTE', palette: 'BASE', level: 50 },
        },
        dark: {
          background: { kind: 'PALETTE', palette: 'BASE', level: 950 },
          card: { kind: 'PALETTE', palette: 'BASE', level: 900 },
        },
      },
    },
  })
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) => route.fulfill({ json: brand }))
  await page.goto('/account/me')

  const colorVariable = (name: string) =>
    page
      .locator('html')
      .evaluate((element, key) => getComputedStyle(element).getPropertyValue(key).trim(), name)
  const channels = (hsl: string) => hsl.slice(4, -1)
  await expect.poll(() => colorVariable('--background')).toBe(channels(colors[100].hsl))
  await expect.poll(() => colorVariable('--card')).toBe(channels(colors[50].hsl))

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => colorVariable('--background')).toBe(channels(colors[950].hsl))
  await expect.poll(() => colorVariable('--card')).toBe(channels(colors[900].hsl))
})

test('brand editor separates neutral and primary shades from complete ramp tuning', async ({
  page,
}) => {
  const version: BrandVersion = {
    ...defaultBrandConfiguration,
    id: id(401),
    revision: 1,
    editRevision: 0,
    status: 'DRAFT',
    publishedAt: null,
    logoAsset: null,
    markAsset: null,
    faviconAsset: null,
  }
  const admin: BrandAdmin = {
    publishedVersionId: null,
    versions: [
      {
        id: version.id,
        revision: version.revision,
        editRevision: version.editRevision,
        status: version.status,
        publishedAt: null,
      },
    ],
  }
  await page.unroute('**/api/v1/iam/session')
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        permissions: ['branding.view', 'branding.manage', 'branding.publish'],
        user: { id: id(200), tenantId: id(201), displayName: '管理员', avatarUrl: null },
      },
    }),
  )
  await page.unroute('**/api/v1/navigation/me')
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, account, branding]) }),
  )
  await page.route('**/api/v1/branding/admin', (route) => route.fulfill({ json: admin }))
  await page.route('**/api/v1/branding/versions/*', (route) => route.fulfill({ json: version }))

  await page.goto('/branding/manage')
  await page.getByRole('combobox', { name: '配置版本' }).click()
  await page.getByRole('option', { name: 'V1 · 草稿' }).click()
  const neutral = page.locator('[data-brand-palette-card="base"]')
  const primary = page.locator('[data-brand-palette-card="primary"]')
  const sections = page.getByRole('navigation', { name: '品牌配置分区' })
  await expect(page.getByRole('heading', { name: '品牌标识' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '主题工作室' })).toBeHidden()
  await sections.getByRole('button', { name: '视觉主题' }).click()
  await expect(sections.getByRole('button', { name: '视觉主题' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(neutral.getByRole('heading', { name: '基础中性色' })).toBeVisible()
  await expect(primary).toHaveCount(0)
  await page.getByRole('tab', { name: '品牌主色' }).click()
  await expect(primary.getByRole('heading', { name: '品牌主色' })).toBeVisible()
  await primary.getByRole('button', { name: '将主色设为 700 色阶' }).click()
  await expect(primary.getByRole('button', { name: '将主色设为 700 色阶' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('tab', { name: '深色应用色' }).click()
  await primary.getByRole('button', { name: '将主色设为 400 色阶' }).click()
  await expect(primary.getByRole('button', { name: '将主色设为 400 色阶' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('tab', { name: '浅色应用色' }).click()
  await expect(primary.getByRole('button', { name: '将主色设为 700 色阶' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('tab', { name: '界面风格' }).click()
  await expect(page.getByText('组件圆角')).toBeVisible()
  await page.getByRole('tab', { name: '基础中性色' }).click()
  await expect(neutral.getByRole('button', { name: '逐级编辑色阶' })).toBeVisible()
  await neutral.getByRole('button', { name: '逐级编辑色阶' }).click()
  const rampDialog = page.getByRole('dialog', { name: '微调基础中性色阶' })
  await expect(rampDialog).toBeVisible()
  await expect(neutral.getByText('已微调色阶')).toHaveCount(0)
  await rampDialog.getByRole('button', { name: '编辑 700 色阶' }).click()
  await expect(rampDialog.getByRole('button', { name: '编辑 700 色阶' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('tab', { name: 'HEX' })).toBeVisible()
  const pickerPopup = page.locator('[data-soybean-popover-popup]').filter({
    has: page.getByRole('tab', { name: 'HEX' }),
  })
  await expect
    .poll(() =>
      pickerPopup.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return top !== null && element.contains(top)
      }),
    )
    .toBe(true)
  const colorArea = pickerPopup.locator('[data-soybean-color-area-area]')
  await expect(colorArea).toBeVisible()
  const colorAreaBox = await colorArea.boundingBox()
  if (!colorAreaBox) throw new Error('Color area has no visible bounds')
  expect(colorAreaBox.width).toBeGreaterThan(150)
  expect(colorAreaBox.height).toBeGreaterThan(100)
  const previousColor = await rampDialog.locator('[data-ramp-color-picker] button').textContent()
  await colorArea.click({ position: { x: 150, y: 35 } })
  await expect(neutral.getByText('已微调色阶')).toBeVisible()
  await expect(rampDialog.locator('[data-ramp-color-picker] button')).not.toHaveText(
    previousColor ?? '',
  )
  await page.keyboard.press('Escape')
  await rampDialog.getByRole('button', { name: '编辑 700 色阶' }).click()
  await expect(page.getByRole('tab', { name: 'HEX' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(rampDialog.locator('[data-ramp-color-picker] button')).toHaveCount(1)
  await expect(rampDialog.locator('[data-ramp-color-picker] button')).toContainText('#')
  await rampDialog.locator('[data-ramp-color-picker] button').click()
  await expect(page.getByRole('tab', { name: 'HEX' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(rampDialog).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(rampDialog).toHaveCSS('width', '358px')
  const bounds = await rampDialog.boundingBox()
  if (!bounds) throw new Error('Ramp dialog has no visible bounds')
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await rampDialog.getByRole('button', { name: '编辑 500 色阶' }).click()
  const mobilePicker = page.locator('[data-soybean-popover-popup]').filter({
    has: page.getByRole('tab', { name: 'HEX' }),
  })
  const mobilePickerBounds = await mobilePicker.boundingBox()
  if (!mobilePickerBounds) throw new Error('Mobile color picker has no visible bounds')
  expect(mobilePickerBounds.x).toBeGreaterThanOrEqual(0)
  expect(mobilePickerBounds.x + mobilePickerBounds.width).toBeLessThanOrEqual(390)
  await expect(mobilePicker.locator('[data-soybean-color-area-area]')).toBeVisible()
  await expect(primary.getByText('已微调色阶')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await rampDialog.getByRole('button', { name: '完成' }).click()
  await page.getByRole('tab', { name: '高级语义色' }).click()
  const semanticGroup = page.locator('details').filter({
    has: page.getByText('表面与文字', { exact: true }),
  })
  await expect(semanticGroup).not.toHaveAttribute('open', '')
  await semanticGroup.locator('summary').click()
  await expect(semanticGroup).toHaveAttribute('open', '')
  await page.setViewportSize({ width: 768, height: 844 })
  await sections.getByRole('button', { name: '工作区布局' }).click()
  await expect(page.getByRole('heading', { name: '工作区默认布局' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '主题工作室' })).toBeHidden()
  await sections.getByRole('button', { name: '视觉主题' }).click()
  await expect(semanticGroup).toHaveAttribute('open', '')
  await sections.getByRole('button', { name: '工作区布局' }).click()
  await page.getByRole('button', { name: '展开实时预览' }).click()
  await expect(page.getByRole('heading', { name: '实时预览' })).toBeVisible()
  const previewBounds = await page.getByRole('heading', { name: '实时预览' }).boundingBox()
  if (!previewBounds) throw new Error('Responsive preview has no visible bounds')
  expect(previewBounds.x + previewBounds.width).toBeLessThanOrEqual(768)
  await page.getByRole('button', { name: '收起实时预览' }).click()
  await sections.getByRole('button', { name: '名称与文案' }).click()
  await page.locator('#brand-system-name').fill('')
  await sections.getByRole('button', { name: '工作区布局' }).click()
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(sections.getByRole('button', { name: /名称与文案/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('#brand-system-name')).toBeVisible()
  await expect(page.getByText('请修正当前分区的校验错误：')).toBeVisible()
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

test('invalid scoped appearance preference falls back to a usable settings panel', async ({
  page,
}) => {
  const key = appearancePreferenceStorageKey(id(201), id(200))
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, '{broken'), key)
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '工作区设置' })).toBeVisible()
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
})

test('mobile settings stay within viewport and reset persisted preferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const resetButton = page.getByRole('button', { name: '恢复外观默认值', exact: true })
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
  await expect(page.getByRole('heading', { name: '管理员' })).toBeVisible()
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

test('user layout overrides stay sparse and continue following tenant defaults', async ({
  page,
}) => {
  let brand = publishedBrand({
    workspaceDefaults: {
      layoutMode: 'top',
      brandPlacement: 'header',
      headerHeight: 72,
      siderWidth: 264,
      showTabs: false,
    },
  })
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) => route.fulfill({ json: brand }))

  await page.goto('/account/me')
  await expect(page.getByRole('navigation', { name: '顶部导航' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '页面标签' })).toHaveCount(0)
  await expect(page.locator('[data-soybean-layout-header]')).toHaveCSS('height', '72px')

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '布局设置' }).click()
  await page.getByRole('radio', { name: '左侧菜单模式' }).click()
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()

  brand = publishedBrand({
    workspaceDefaults: {
      layoutMode: 'top',
      brandPlacement: 'header',
      headerHeight: 84,
      siderWidth: 304,
      showTabs: true,
    },
  })
  await page.reload()

  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '页面标签' })).toBeVisible()
  await expect(page.locator('[data-soybean-layout-header]')).toHaveCSS('height', '84px')
  await expect(page.locator('[data-soybean-layout-sidebar] > div:nth-child(2)')).toHaveCSS(
    'width',
    '304px',
  )
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
      json: publishedBrand({
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
      }),
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
