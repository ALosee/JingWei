import { expect, test, type Page } from '@playwright/test'

import {
  defaultBrandConfiguration,
  defaultEffectiveBrand,
  type BrandConfiguration,
  type BrandAdmin,
  type BrandVersion,
  type EffectiveBrand,
} from '@jingwei/module-branding/shared'
import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'
import { THEME_STORAGE_KEY as storageKey } from '@jingwei/ui/theme-init'
import { generateThemePaletteColors } from '@jingwei/ui/theme-palette'

import { appearancePreferenceStorageKey } from '../src/stores/appearance.js'

const id = (value: number) => '00000000-0000-7000-8000-' + String(value).padStart(12, '0')
// RGB channels are irrelevant at alpha zero; browsers may retain the fallback channels.
const transparentColor = /^rgba\([^)]*, 0\)$/
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
  await page.emulateMedia({ colorScheme: 'light' })
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

test('workspace settings combine density and layout and persist across reloads', async ({
  page,
}) => {
  await page.goto('/account/me')
  const mode = page.getByRole('button', { name: /^明暗模式：/ })
  await expect(mode).toHaveAccessibleName('明暗模式：跟随系统，点击切换到白天模式')
  await mode.click()
  await mode.click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const panel = page.getByRole('dialog', { name: '工作区设置' })
  await expect(panel).toBeVisible()
  await expect(page.locator('[data-vean-dialog-overlay]')).toHaveCount(0)
  await expectWorkspaceSettings(panel)
  await panel.getByRole('combobox', { name: '界面密度' }).click()
  await page.getByRole('option', { name: '偏小', exact: true }).click()
  await expect(panel.getByRole('combobox', { name: '界面密度' })).toContainText('偏小')
  await panel.screenshot({ path: '/tmp/jingwei-workspace-settings-desktop.png' })
  await page.mouse.click(8, 8)
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(mode).toHaveAccessibleName('明暗模式：黑夜模式，点击切换到跟随系统')
  await expect(page.locator('#vean-theme')).toHaveCount(1)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await expect(panel.getByRole('combobox', { name: '界面密度' })).toContainText('偏小')
})

async function expectWorkspaceSettings(panel: ReturnType<Page['getByRole']>): Promise<void> {
  await expect(panel.getByRole('heading', { name: '工作区设置' })).toBeVisible()
  await expect(panel.getByRole('tab', { name: '外观设置', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('tab', { name: '布局设置', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('tablist', { name: '明暗模式' })).toHaveCount(0)
  await expect(panel.getByRole('combobox', { name: '界面密度' })).toBeVisible()
  const modes = panel.getByRole('radiogroup', { name: '布局模式' }).getByRole('radio')
  await expect(modes).toHaveCount(6)
  const bounds = await modes.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y } = element.getBoundingClientRect()
      return { x, y }
    }),
  )
  const [first, second, third, fourth, fifth, sixth] = bounds
  if (!first || !second || !third || !fourth || !fifth || !sixth)
    throw new Error('Layout choices have no visible bounds')
  expect(first.y).toBe(second.y)
  expect(second.y).toBe(third.y)
  expect(first.x).toBeLessThan(second.x)
  expect(second.x).toBeLessThan(third.x)
  expect(fourth.y).toBeGreaterThan(first.y)
  expect(fourth.y).toBe(fifth.y)
  expect(fifth.y).toBe(sixth.y)
  expect(fourth.x).toBe(first.x)
}

test('header theme button cycles modes, follows system changes and persists the preference', async ({
  page,
}) => {
  await page.goto('/account/me')
  const mode = page.getByRole('button', { name: /^明暗模式：/ })
  await expect(mode).toHaveAccessibleName('明暗模式：跟随系统，点击切换到白天模式')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await mode.focus()
  await page.keyboard.press('Space')
  await expect(mode).toHaveAccessibleName('明暗模式：白天模式，点击切换到黑夜模式')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.keyboard.press('Enter')
  await expect(mode).toHaveAccessibleName('明暗模式：黑夜模式，点击切换到跟随系统')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await mode.click()
  await expect(mode).toHaveAccessibleName('明暗模式：跟随系统，点击切换到白天模式')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(mode).toHaveAccessibleName('明暗模式：跟随系统，点击切换到白天模式')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await mode.click()
  await expect(mode).toHaveAccessibleName('明暗模式：白天模式，点击切换到黑夜模式')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
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
        JSON.stringify({ base: 'gray', primary: 'blue', radius: '2xs', size: 'lg', mode: 'light' }),
      )
    },
    { key: storageKey },
  )
  await page.goto('/account/me')
  await expect(page.locator('html')).toHaveClass(/dark/)
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
  const primaryColors = generateThemePaletteColors('#c0356b')
  const brand = publishedBrand({
    visualTheme: {
      ...defaultEffectiveBrand.visualTheme,
      customBasePalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '租户中性色',
        seedColor: '#75839a',
        colors,
      },
      customPrimaryPalette: {
        profile: 'OKLCH_PALETTE_V1',
        name: '租户主色',
        seedColor: '#c0356b',
        colors: primaryColors,
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
  await expect.poll(() => colorVariable('--primary-50')).toBe(channels(primaryColors[50].hsl))
  await expect.poll(() => colorVariable('--primary-950')).toBe(channels(primaryColors[950].hsl))

  await page.getByRole('button', { name: /^明暗模式：/ }).click()
  await page.getByRole('button', { name: /^明暗模式：/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => colorVariable('--background')).toBe(channels(colors[950].hsl))
  await expect.poll(() => colorVariable('--card')).toBe(channels(colors[900].hsl))
})

test('opaque card backgrounds and primary text survive updates to transparent and back', async ({
  page,
}) => {
  let transparent = false
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: publishedBrand({
        horizontalBrandMode: 'SHORT_NAME',
        visualTheme: {
          ...defaultEffectiveBrand.visualTheme,
          overrides: {
            light: {
              primary: { kind: 'LITERAL', value: 'hsl(0 100% 50%)' },
              card: transparent
                ? { kind: 'SIMPLE', value: 'transparent' }
                : { kind: 'LITERAL', value: 'hsl(210 100% 80%)' },
            },
            dark: {},
          },
        },
      }),
    }),
  )
  await page.goto('/account/me')
  const wordmark = page.locator('[data-global-brand-wordmark]').first()
  const card = page
    .getByRole('textbox', { name: '显示名', exact: true })
    .locator('xpath=ancestor::*[@data-vean-input-root]')
  await expect(wordmark).toHaveCSS('color', 'rgb(255, 0, 0)')
  await expect(card).toHaveCSS('background-color', 'rgb(153, 204, 255)')
  transparent = true
  await page.reload()
  await expect(card).toHaveCSS('background-color', transparentColor)
  await expect(wordmark).toHaveCSS('color', 'rgb(255, 0, 0)')
  transparent = false
  await page.reload()
  await expect(card).toHaveCSS('background-color', 'rgb(153, 204, 255)')
  await expect(wordmark).toHaveCSS('color', 'rgb(255, 0, 0)')
})

test('published transparent cards render in light mode and honor an opaque dark override', async ({
  page,
}) => {
  const brand = publishedBrand({
    visualTheme: {
      ...defaultEffectiveBrand.visualTheme,
      overrides: {
        light: {
          background: { kind: 'SIMPLE', value: 'transparent' },
          card: { kind: 'SIMPLE', value: 'transparent' },
        },
        dark: {
          background: { kind: 'PALETTE', palette: 'BASE', level: 950 },
          card: { kind: 'SIMPLE', value: 'white' },
        },
      },
    },
  })
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) => route.fulfill({ json: brand }))
  await page.goto('/account/me')
  const surface = page
    .getByRole('textbox', { name: '显示名', exact: true })
    .locator('xpath=ancestor::*[@data-vean-input-root]')
  await expect(surface).toHaveCSS('background-color', transparentColor)
  await expect(page.locator('body')).toHaveCSS('background-color', transparentColor)
  await page.getByRole('button', { name: /^明暗模式：/ }).click()
  await page.getByRole('button', { name: /^明暗模式：/ }).click()
  await expect(surface).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.reload()
  await expect(surface).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: /^明暗模式：/ }).click()
  await page.getByRole('button', { name: /^明暗模式：/ }).click()
  await expect(surface).toHaveCSS('background-color', transparentColor)
})

test('brand editor previews transparent cards, keeps draft opacity isolated and resets to opaque', async ({
  page,
}) => {
  const version: BrandVersion = {
    ...defaultBrandConfiguration,
    id: id(402),
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
      { id: version.id, revision: 1, editRevision: 0, status: 'DRAFT', publishedAt: null },
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
  await page
    .getByRole('navigation', { name: '品牌配置分区' })
    .getByRole('button', { name: '视觉主题' })
    .click()
  await page.getByRole('tab', { name: '高级语义色' }).click()
  await page.getByText('表面与文字', { exact: true }).click()
  const cardRow = page.getByText('卡片背景', { exact: true }).locator('../..')
  await cardRow.getByRole('button', { name: '设置', exact: true }).click()
  await cardRow.locator('summary').click()
  await cardRow.getByRole('tab', { name: '基础色', exact: true }).click()
  await cardRow.getByRole('button', { name: '透明', exact: true }).click()
  await expect(cardRow.getByRole('button', { name: '透明', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('[data-ui-theme-scope] [class~="bg-card/40"]')).toHaveCSS(
    'background-color',
    transparentColor,
  )
  await page.getByRole('tab', { name: '登录页', exact: true }).click()
  const card = page.locator('[data-ui-theme-scope] .bg-card')
  await expect(card).toHaveCSS('background-color', transparentColor)
  await expect
    .poll(() =>
      page
        .locator('html')
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--card-alpha').trim()),
    )
    .toBe('1')
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expect(card).toHaveCSS('background-color', transparentColor)
  await cardRow.getByRole('button', { name: '白色', exact: true }).click()
  await expect(card).not.toHaveCSS('background-color', transparentColor)
  await cardRow.getByRole('button', { name: '重置', exact: true }).click()
  await expect(card).not.toHaveCSS('background-color', transparentColor)
  await expect(cardRow.getByText('跟随系统推导', { exact: true })).toBeVisible()
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
  const pickerPopup = page.locator('[data-vean-popover-popup]').filter({
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
  const colorArea = pickerPopup.locator('[data-vean-color-area-area]')
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
  const mobilePicker = page.locator('[data-vean-popover-popup]').filter({
    has: page.getByRole('tab', { name: 'HEX' }),
  })
  const mobilePickerBounds = await mobilePicker.boundingBox()
  if (!mobilePickerBounds) throw new Error('Mobile color picker has no visible bounds')
  expect(mobilePickerBounds.x).toBeGreaterThanOrEqual(0)
  expect(mobilePickerBounds.x + mobilePickerBounds.width).toBeLessThanOrEqual(390)
  await expect(mobilePicker.locator('[data-vean-color-area-area]')).toBeVisible()
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

test('mobile settings stay within viewport and reset density and layout independently of theme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/account/me')
  const mode = page.getByRole('button', { name: /^明暗模式：/ })
  await mode.click()
  await mode.click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '工作区设置' })
  await expectWorkspaceSettings(settings)
  const resetButton = settings.getByRole('button', { name: '恢复默认设置', exact: true })
  await expect(resetButton).toBeDisabled()
  await settings.getByRole('combobox', { name: '界面密度' }).click()
  await page.getByRole('option', { name: '偏小', exact: true }).click()
  await expect(resetButton).toBeEnabled()
  await settings.getByRole('radio', { name: '顶部菜单模式' }).click()
  await resetButton.scrollIntoViewIfNeeded()
  await resetButton.click()
  await expect(page.locator('[data-vean-app-shell]')).toHaveAttribute('data-mode', 'sidebar')
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(resetButton).toBeDisabled()
  await expect(settings.getByRole('combobox', { name: '界面密度' })).toContainText('标准')
  await settings.evaluate((element) => {
    element.scrollTop = 0
  })
  await settings.screenshot({ path: '/tmp/jingwei-workspace-settings-mobile.png' })
  const panel = await settings.boundingBox()
  if (!panel) throw new Error('Settings panel has no visible bounds')
  expect(panel.x).toBeGreaterThanOrEqual(0)
  expect(panel.x + panel.width).toBeLessThanOrEqual(390)
  await page.mouse.click(8, 8)
  await page.keyboard.press('Escape')
  await expect(settings).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
  await expect(page.locator('[data-vean-app-shell]')).toHaveAttribute('data-mode', 'sidebar')
})

test('layout mode, dimensions and tab visibility persist', async ({ page }) => {
  await page.goto('/account/me')
  await expect(page.getByRole('tree', { name: '主导航' })).toBeVisible()
  await expect(page.locator('[data-vean-app-shell-tab]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '管理员' })).toBeVisible()
  const layoutRoot = page.locator('[data-vean-layout-root]')
  await page
    .getByRole('button', { name: '切换侧边栏' })
    .and(page.locator('[data-vean-layout-trigger]'))
    .click()
  await expect(layoutRoot).toHaveAttribute('data-state', 'collapsed')
  await page
    .getByRole('button', { name: '切换侧边栏' })
    .and(page.locator('[data-vean-layout-trigger]'))
    .click()
  await expect(layoutRoot).toHaveAttribute('data-state', 'expanded')

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const headerHeight = page.getByRole('spinbutton', { name: 'Header 高度' })
  const siderWidth = page.getByRole('spinbutton', { name: 'Sider 宽度' })
  await headerHeight.fill('80')
  await headerHeight.press('Tab')
  await siderWidth.fill('288')
  await siderWidth.press('Tab')
  await expect(page.locator('[data-vean-layout-header]')).toHaveCSS('height', '80px')
  await expect(page.locator('[data-vean-layout-sidebar] > div:nth-child(2)')).toHaveCSS(
    'width',
    '288px',
  )
  await page.getByRole('tab', { name: '侧栏底部', exact: true }).click()
  await page.getByRole('radio', { name: '顶部菜单模式' }).click()
  await expect(siderWidth).toHaveCount(0)
  await expect(page.getByText('侧边栏宽度')).toHaveCount(0)
  await expect(page.getByText('品牌位置')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '侧栏底部', exact: true })).toHaveCount(0)
  await page.getByRole('switch', { name: /显示页面标签/u }).click()
  await expect(page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')).toBeVisible()
  await expect(page.getByRole('tree', { name: '主导航' })).toHaveCount(0)
  await expect(page.locator('[data-vean-app-shell-tab]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '经纬企业平台首页' })).toHaveCount(1)

  await page.reload()
  await expect(page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')).toBeVisible()
  await expect(page.locator('[data-vean-app-shell-tab]')).toHaveCount(0)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await expect(siderWidth).toHaveCount(0)
  await expect(page.getByText('品牌位置')).toHaveCount(0)
  await page.getByRole('radio', { name: '左侧菜单模式' }).click()
  await expect(siderWidth).toHaveValue('288')
  await expect(page.getByText('侧边栏宽度')).toBeVisible()
  await expect(page.getByText('品牌位置')).toBeVisible()
  await expect(page.getByRole('tab', { name: '侧栏底部', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('user layout overrides stay sparse and continue following tenant defaults', async ({
  page,
}) => {
  let brand = publishedBrand({
    workspaceDefaults: {
      layoutMode: 'top',
      brandPlacement: 'header',
      sidebarVariant: 'sidebar',
      headerHeight: 72,
      siderWidth: 264,
      showTabs: false,
    },
  })
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) => route.fulfill({ json: brand }))

  await page.goto('/account/me')
  await expect(page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')).toBeVisible()
  await expect(page.locator('[data-vean-app-shell-tab]')).toHaveCount(0)
  await expect(page.locator('[data-vean-layout-header]')).toHaveCSS('height', '72px')

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('radio', { name: '左侧菜单模式' }).click()
  await expect(page.getByRole('tree', { name: '主导航' })).toBeVisible()

  brand = publishedBrand({
    workspaceDefaults: {
      layoutMode: 'top',
      brandPlacement: 'header',
      sidebarVariant: 'sidebar',
      headerHeight: 84,
      siderWidth: 304,
      showTabs: true,
    },
  })
  await page.reload()

  await expect(page.getByRole('tree', { name: '主导航' })).toBeVisible()
  await expect(page.locator('[data-vean-app-shell-tab]')).toBeVisible()
  await expect(page.locator('[data-vean-layout-header]')).toHaveCSS('height', '84px')
  await expect(page.locator('[data-vean-layout-sidebar] > div:nth-child(2)')).toHaveCSS(
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
  const activeTab = page.locator('[data-vean-page-tabs-item][data-selected="true"]')
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
  const sidebarWrapper = page.locator('[data-vean-layout-sidebar] > div:nth-child(2)')
  const sidebar = page.locator('[data-sidebar="sidebar"]')
  const header = page.locator('[data-vean-layout-header]')
  const tabs = page.locator('[data-vean-layout-tab]')

  await expect(sidebarWrapper).toHaveCSS('border-inline-end-width', '1px')
  await expect(sidebar).toHaveCSS('border-inline-end-width', '0px')
  await expect(header).toHaveCSS('border-bottom-width', '1px')
  await expect(tabs).toHaveCSS('border-top-width', '0px')
  await expect(tabs).toHaveCSS('border-bottom-width', '1px')
})

test('native shell keeps a header brand expanded and folds a sidebar brand', async ({ page }) => {
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: publishedBrand({
        workspaceDefaults: { ...defaultEffectiveBrand.workspaceDefaults, brandPlacement: 'header' },
      }),
    }),
  )
  await page.goto('/account/me')
  const headerBrand = page.locator('[data-vean-app-shell-logo][data-placement="header"]')
  await expect(headerBrand.locator('[data-global-brand-wordmark]')).toBeVisible()
  await page.locator('[data-vean-layout-trigger]').click()
  await expect(headerBrand.locator('[data-global-brand-wordmark]')).toBeVisible()
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '侧栏顶部', exact: true }).click()
  const sidebarBrand = page.locator('[data-vean-app-shell-logo][data-placement="sidebar"]')
  await expect(sidebarBrand).toBeVisible()
  await expect(headerBrand).toHaveCount(0)
  await expect(sidebarBrand.locator('[data-global-brand-wordmark]')).toHaveCount(0)
})

test('collapsed tree menu aligns active and hover surfaces in the sider', async ({ page }) => {
  await page.goto('/account/me')
  await page
    .getByRole('button', { name: '切换侧边栏' })
    .and(page.locator('[data-vean-layout-trigger]'))
    .click()

  const layoutRoot = page.locator('[data-vean-layout-root]')
  const sider = page.locator('[data-sidebar="sidebar"]')
  const accountItem = page
    .getByRole('tree', { name: '主导航' })
    .getByRole('link', { name: '个人账号' })
  const hoverSurface = accountItem.locator('xpath=ancestor::*[@data-vean-tree-menu-item][1]')

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
  const header = page.locator('[data-vean-layout-header]')
  const content = page.locator('[data-vean-layout-content]')
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

test('native sidebar occupies full height with either brand placement', async ({ page }) => {
  await page.goto('/account/me')
  const root = page.locator('[data-vean-layout-root]')
  const header = page.locator('[data-vean-layout-header]')
  const sider = page.locator('[data-sidebar="sidebar"]')
  await expect(root).toHaveAttribute('data-orientation', 'horizontal')
  const headerBox = await header.boundingBox()
  const siderBox = await sider.boundingBox()
  if (!headerBox || !siderBox) throw new Error('Native layout regions have no bounds')
  expect(siderBox.y).toBeLessThan(1)
  expect(headerBox.x).toBeGreaterThanOrEqual(siderBox.x + siderBox.width - 1)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '侧栏顶部', exact: true }).click()
  await expect(root).toHaveAttribute('data-orientation', 'horizontal')
})

function topNavigationContainer(
  value: number,
  code: string,
  name: string,
  parentId: string | null = null,
  type: 'DIRECTORY' | 'GROUP' = 'DIRECTORY',
): NavigationNode {
  return {
    ...login,
    id: id(value),
    code,
    name,
    type,
    parentId,
    routeKey: null,
    path: null,
    layout: null,
    accessMode: null,
    params: {},
    query: {},
  }
}

async function prepareTopNavigation(page: Page, nodes: NavigationNode[], path = '/account/me') {
  let bootstrapRequests = 0
  await page.unroute('**/api/v1/navigation/bootstrap')
  await page.route('**/api/v1/navigation/bootstrap*', (route) => {
    bootstrapRequests += 1
    return route.fulfill({ json: response([login]) })
  })
  await page.route('**/api/v1/iam/roles', (route) => route.fulfill({ json: { roles: [] } }))
  await page.route('**/api/v1/iam/permissions', (route) =>
    route.fulfill({ json: { permissions: [] } }),
  )
  await page.unroute('**/api/v1/navigation/me')
  await page.route('**/api/v1/navigation/me', (route) => route.fulfill({ json: response(nodes) }))
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: publishedBrand({
        workspaceDefaults: { ...defaultEffectiveBrand.workspaceDefaults, layoutMode: 'top' },
      }),
    }),
  )
  await page.goto(path)
  await expect(page.locator('[data-vean-app-shell]')).toBeVisible()
  return () => bootstrapRequests
}

test('TreeNav top-level icons follow selection and return to their inactive color', async ({
  page,
}) => {
  await page.route('**/lucide.json*', (route) =>
    route.fulfill({
      json: {
        prefix: 'lucide',
        width: 24,
        height: 24,
        icons: {
          user: { body: '<path d="M6 20v-2a6 6 0 0 1 12 0v2M12 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8"/>' },
          shield: { body: '<path d="M12 3l8 4v6c0 4-8 8-8 8s-8-4-8-8V7z"/>' },
        },
      },
    }),
  )
  const roles: NavigationNode = {
    ...account,
    id: id(799),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    icon: 'lucide:shield',
    accessMode: 'PERMISSION',
  }
  await prepareTopNavigation(page, [login, account, roles])
  const navigation = page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')
  const accountLink = navigation.getByRole('link', { name: '个人账号', exact: true })
  const rolesLink = navigation.getByRole('link', { name: '角色权限', exact: true })
  const accountIcon = accountLink.locator('svg')
  const rolesIcon = rolesLink.locator('svg')
  await expect(accountLink).toHaveAttribute('data-selected', 'true')
  const selectedColor = await accountLink.evaluate((element) => getComputedStyle(element).color)
  await expect(accountIcon).toHaveCSS('color', selectedColor)
  const inactiveColor = await rolesIcon.evaluate((element) => getComputedStyle(element).color)
  expect(inactiveColor).not.toBe(selectedColor)
  await rolesLink.click()
  await expect(rolesLink).toHaveAttribute('data-selected', 'true')
  await expect(rolesIcon).toHaveCSS('color', selectedColor)
  await expect(accountLink).toHaveAttribute('data-selected', 'false')
  await expect(accountIcon).toHaveCSS('color', inactiveColor)
})

test('TreeNav popup icons follow selection and return to their inactive color', async ({
  page,
}) => {
  const system = topNavigationContainer(790, 'top.system', '系统管理')
  const nestedAccount = { ...account, parentId: system.id }
  const roles: NavigationNode = {
    ...nestedAccount,
    id: id(791),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    icon: 'lucide:shield',
    accessMode: 'PERMISSION',
  }
  await prepareTopNavigation(page, [login, system, nestedAccount, roles])
  const trigger = page
    .locator('[data-vean-app-shell-header] [data-vean-tree-nav]')
    .getByRole('button', { name: '系统管理' })
  await trigger.hover()
  const accountItem = page.getByRole('menuitem', { name: '个人账号', exact: true })
  const rolesItem = page.getByRole('menuitem', { name: '角色权限', exact: true })
  const accountIcon = accountItem.locator('[data-vean-icon]')
  const rolesIcon = rolesItem.locator('[data-vean-icon]')
  await expect(accountItem).toHaveAttribute('data-selected', 'true')
  const selectedColor = await accountItem.evaluate((element) => getComputedStyle(element).color)
  await expect(accountIcon).toHaveCSS('color', selectedColor)
  const inactiveColor = await rolesIcon.evaluate((element) => getComputedStyle(element).color)
  expect(inactiveColor).not.toBe(selectedColor)
  await rolesItem.click()
  await expect(page).toHaveURL(/\/roles$/)
  await trigger.hover()
  await expect(rolesItem).toHaveAttribute('data-selected', 'true')
  await expect(rolesIcon).toHaveCSS('color', selectedColor)
  await expect(accountItem).toHaveAttribute('data-selected', 'false')
  await expect(accountIcon).toHaveCSS('color', inactiveColor)
})

test('TreeNav keeps nested route highlights across hover, selection and refresh', async ({
  page,
}, testInfo) => {
  const system = topNavigationContainer(800, 'top.system', '系统管理')
  const accounts = topNavigationContainer(801, 'top.accounts', '账号设置', system.id)
  const group = topNavigationContainer(802, 'top.account-group', '账户入口', accounts.id, 'GROUP')
  const nestedAccount = { ...account, parentId: group.id }
  const overview = {
    ...nestedAccount,
    id: id(803),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    accessMode: 'PERMISSION' as const,
  }
  const countBootstrap = await prepareTopNavigation(page, [
    login,
    system,
    accounts,
    group,
    nestedAccount,
    overview,
  ])
  const navigation = page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')
  const trigger = navigation.getByRole('button', { name: '系统管理' })
  await expect(trigger).toHaveAttribute('data-child-selected', '')

  await expect(navigation).toHaveCSS('border-top-width', '0px')
  await trigger.hover()
  const accountsItem = page.getByRole('menuitem', { name: '账号设置' })
  await expect(accountsItem).toBeVisible()
  await expect(accountsItem.locator('[data-vean-icon]').first()).toHaveCSS(
    'color',
    await accountsItem.evaluate((element) => getComputedStyle(element).color),
  )
  await accountsItem.hover()
  await expect(page.getByText('账户入口', { exact: true })).toBeVisible()
  const current = page.getByRole('menuitem', { name: '个人账号' })
  await expect(current).toHaveAttribute('data-selected', 'true')
  const profileInput = page.getByRole('textbox', { name: '显示名', exact: true })
  await profileInput.click()
  await expect(profileInput).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await trigger.hover()
  await accountsItem.hover()
  const beforeClick = countBootstrap()
  await page.getByRole('menuitem', { name: '角色权限' }).click()
  await expect(page).toHaveURL(/\/roles$/)
  expect(countBootstrap()).toBe(beforeClick)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toHaveAttribute('data-child-selected', '')
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  await expect(accountsItem).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: '角色权限' })).toHaveAttribute(
    'data-selected',
    'true',
  )
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('data-child-selected', '')
  await page.reload()
  await expect(trigger).toHaveAttribute('data-child-selected', '')
  await page
    .locator('[data-vean-layout-header]')
    .screenshot({ path: testInfo.outputPath('tree-nav-header.png') })
})

test('TreeNav more menu preserves selected ancestors and restores entries when width grows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 })
  const branches = Array.from({ length: 12 }, (_, index) =>
    topNavigationContainer(850 + index, `top.shortcut-${index}`, `快捷入口 ${index + 1}`),
  )
  const leaves: NavigationNode[] = branches.map((branch, index) =>
    index === branches.length - 1
      ? { ...account, parentId: branch.id, name: '入口 12 页面' }
      : {
          ...login,
          id: id(870 + index),
          code: `top.shortcut-link-${index}`,
          name: `入口 ${index + 1} 页面`,
          type: 'EXTERNAL_LINK',
          parentId: branch.id,
          routeKey: null,
          path: null,
          layout: null,
          accessMode: 'AUTHENTICATED',
          href: `https://example.com/shortcut-${index}`,
          externalTarget: 'BLANK',
          params: {},
        },
  )
  await prepareTopNavigation(page, [login, ...branches, ...leaves])
  const navigation = page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')
  const more = navigation.getByRole('button', { name: '更多' })
  await expect(more).toBeVisible()
  await expect(more).toHaveAttribute('data-child-selected', '')
  const box = await navigation.boundingBox()
  const moreBox = await more.boundingBox()
  if (box === null || moreBox === null) throw new Error('TreeNav overflow menu has no bounds')
  expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(box.x + box.width + 1)
  await more.hover()
  await page.getByRole('menuitem', { name: '快捷入口 12', exact: true }).hover()
  await expect(page.getByRole('menuitem', { name: '入口 12 页面', exact: true })).toHaveAttribute(
    'data-selected',
    'true',
  )
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 2400, height: 900 })
  await expect(more).toHaveCount(0)
  await expect(
    navigation.getByRole('button', { name: '快捷入口 12', exact: true }),
  ).toHaveAttribute('data-child-selected', '')
})

test('top mode uses the full native menu drawer on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const system = topNavigationContainer(900, 'top.system', '系统管理')
  const nestedAccount = { ...account, parentId: system.id }
  const roles = {
    ...nestedAccount,
    id: id(901),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    accessMode: 'PERMISSION' as const,
  }
  await prepareTopNavigation(page, [login, system, nestedAccount, roles])
  await expect(page.locator('[data-vean-app-shell-header] [data-vean-tree-nav]')).toHaveCount(0)
  await page.locator('[data-vean-layout-trigger]').click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('link', { name: '个人账号' })).toBeVisible()
  await drawer.getByRole('link', { name: '角色权限' }).click()
  await expect(page).toHaveURL(/\/roles$/)
  await expect(drawer).toHaveCount(0)
})

for (const mode of [
  'dual-vertical',
  'vertical-horizontal',
  'horizontal-vertical',
  'horizontal-dual-vertical',
] as const) {
  test(`${mode} uses tenant defaults and native pane widths`, async ({ page }) => {
    const workspace = topNavigationContainer(910, 'workspace', '工作区')
    const system = topNavigationContainer(911, 'system', '系统管理', workspace.id)
    await page.unroute('**/api/v1/navigation/me')
    await page.route('**/api/v1/navigation/me', (route) =>
      route.fulfill({
        json: response([login, workspace, system, { ...account, parentId: system.id }]),
      }),
    )
    await page.unroute('**/api/v1/branding/bootstrap*')
    await page.route('**/api/v1/branding/bootstrap*', (route) =>
      route.fulfill({
        json: publishedBrand({
          workspaceDefaults: { ...defaultEffectiveBrand.workspaceDefaults, layoutMode: mode },
        }),
      }),
    )
    await page.goto('/account/me')
    await expect(page.locator('[data-vean-app-shell]')).toHaveAttribute('data-mode', mode)
    await expect(page.getByRole('heading', { name: '管理员' })).toBeVisible()
    const content = await page.locator('[data-vean-layout-content]').boundingBox()
    if (!content) throw new Error('Mixed-mode content is missing')
    expect(content.width).toBeGreaterThan(400)
    await page.screenshot({ path: `/tmp/jingwei-shell-${mode}.png` })
    await page.getByRole('button', { name: '工作区设置', exact: true }).click()
    await expect(page.getByRole('spinbutton', { name: 'Sider 宽度' })).toBeDisabled()
    await page.reload()
    await expect(page.locator('[data-vean-app-shell]')).toHaveAttribute('data-mode', mode)
  })
}

test('hidden PAGE keeps the native breadcrumb and ancestor links', async ({ page }) => {
  const system = topNavigationContainer(920, 'system', '系统管理')
  const roles = {
    ...account,
    id: id(921),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    parentId: system.id,
    accessMode: 'PERMISSION' as const,
  }
  const detail = { ...account, type: 'PAGE' as const, name: '账号详情', parentId: roles.id }
  await page.unroute('**/api/v1/navigation/me')
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, system, roles, detail]) }),
  )
  await page.route('**/api/v1/iam/roles', (route) => route.fulfill({ json: { roles: [] } }))
  await page.route('**/api/v1/iam/permissions', (route) =>
    route.fulfill({ json: { permissions: [] } }),
  )
  await page.goto('/account/me?tab=security#details')
  const header = page.locator('[data-vean-app-shell-header]')
  await expect(header.getByText('账号详情', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('tree', { name: '主导航' }).getByText('账号详情', { exact: true }),
  ).toHaveCount(0)
  await header.getByRole('button', { name: '系统管理' }).hover()
  await expect(page.getByRole('menuitem', { name: '账号详情', exact: true })).toHaveCount(0)
  await page.getByRole('menuitem', { name: '角色权限', exact: true }).click()
  await expect(page).toHaveURL(/\/roles$/)
  const tabs = page.locator('[data-vean-app-shell-tab]')
  await tabs.getByText('账号详情', { exact: true }).click()
  await expect(page).toHaveURL(/\/account\/me\?tab=security#details$/)
})

test('native tab close preserves the final tab and hiding tabs keeps visited locations', async ({
  page,
}) => {
  const roles = {
    ...account,
    id: id(930),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    accessMode: 'PERMISSION' as const,
  }
  await page.unroute('**/api/v1/navigation/me')
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, account, roles]) }),
  )
  await page.route('**/api/v1/iam/roles', (route) => route.fulfill({ json: { roles: [] } }))
  await page.route('**/api/v1/iam/permissions', (route) =>
    route.fulfill({ json: { permissions: [] } }),
  )
  await page.goto('/account/me?tab=security')
  await page.getByRole('tree', { name: '主导航' }).getByRole('link', { name: '角色权限' }).click()
  const tabs = page.locator('[data-vean-app-shell-tab]')
  await expect(tabs.locator('[data-vean-page-tabs-item]')).toHaveCount(2)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('switch', { name: /显示页面标签/u }).click()
  await expect(tabs).toHaveCount(0)
  await page.getByRole('switch', { name: /显示页面标签/u }).click()
  await page.keyboard.press('Escape')
  await expect(tabs.locator('[data-vean-page-tabs-item]')).toHaveCount(2)
  await tabs
    .locator('[data-vean-page-tabs-item][data-selected="true"] [data-vean-page-tabs-close]')
    .click()
  await expect(page).toHaveURL(/\/account\/me\?tab=security$/)
  await expect(tabs.locator('[data-vean-page-tabs-item]')).toHaveCount(1)
  await tabs.locator('[data-vean-page-tabs-close]').click()
  await expect(tabs.locator('[data-vean-page-tabs-item]')).toHaveCount(1)
})

async function openBrandPreviewDraft(
  page: Page,
  outerMode: 'left' | 'top' = 'top',
  configuration = defaultBrandConfiguration,
) {
  const version: BrandVersion = {
    ...configuration,
    id: id(950),
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
      { id: version.id, revision: 1, editRevision: 0, status: 'DRAFT', publishedAt: null },
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
  await page.unroute('**/api/v1/branding/bootstrap*')
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: publishedBrand({
        workspaceDefaults: { ...defaultEffectiveBrand.workspaceDefaults, layoutMode: outerMode },
      }),
    }),
  )
  await page.route('**/api/v1/branding/admin', (route) => route.fulfill({ json: admin }))
  await page.route('**/api/v1/branding/versions/*', (route) => route.fulfill({ json: version }))
  await page.goto('/branding/manage')
  await page.getByRole('combobox', { name: '配置版本' }).click()
  await page.getByRole('option', { name: 'V1 · 草稿' }).click()
}

test('collapsed sidebar keeps the complete brand mark centered and unclipped', async ({ page }) => {
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: publishedBrand({
        workspaceDefaults: { ...defaultEffectiveBrand.workspaceDefaults, brandPlacement: 'sider' },
      }),
    }),
  )
  await page.goto('/account/me')
  await page.locator('[data-vean-layout-trigger]').click()
  const mark = page.locator('[data-vean-app-shell-logo] [data-global-brand-mark]')
  await expect(mark).toBeVisible()
  await expect
    .poll(() =>
      mark.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        let visibleWidth = rect.width
        let visibleHeight = rect.height
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          const box = ancestor.getBoundingClientRect()
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX))
            visibleWidth = Math.min(
              visibleWidth,
              Math.max(0, Math.min(rect.right, box.right) - Math.max(rect.left, box.left)),
            )
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY))
            visibleHeight = Math.min(
              visibleHeight,
              Math.max(0, Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top)),
            )
        }
        return Math.min(visibleWidth / rect.width, visibleHeight / rect.height)
      }),
    )
    .toBeGreaterThanOrEqual(0.99)
  const markBox = await mark.boundingBox()
  const sidebarBox = await page.locator('[data-sidebar="sidebar"]').boundingBox()
  if (!markBox || !sidebarBox) throw new Error('Brand bounds are unavailable')
  expect(
    Math.abs(markBox.x + markBox.width / 2 - sidebarBox.x - sidebarBox.width / 2),
  ).toBeLessThanOrEqual(1)
})

test('layout choices show six distinct region thumbnails', async ({ page }) => {
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const thumbnails = page.locator('[data-layout-mode-preview]')
  await expect(thumbnails).toHaveCount(6)
  const drawings = await thumbnails.evaluateAll((elements) =>
    elements.map((element) => element.innerHTML),
  )
  expect(new Set(drawings).size).toBe(6)
})

test('brand preview has a compact section rail and visible sidebar under a top workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await openBrandPreviewDraft(page)
  const sections = page.getByRole('navigation', { name: '品牌配置分区' })
  const preview = page.getByRole('heading', { name: '实时预览' }).locator('../..')
  const sectionBox = await sections.boundingBox()
  const previewBox = await preview.boundingBox()
  if (!sectionBox || !previewBox) throw new Error('Brand editor bounds are unavailable')
  expect(sectionBox.width).toBeLessThanOrEqual(160)
  expect(previewBox.width).toBeGreaterThanOrEqual(650)
  const sidebar = page.locator('[data-ui-theme-scope] [data-sidebar="sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByText('品牌定制', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/jingwei-brand-preview-wide.png' })
})

test('all brand preview modes stay independent of a collapsed outer workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openBrandPreviewDraft(page, 'left')
  await page.locator('[data-vean-layout-trigger]').first().click()
  const outer = page.locator('[data-vean-app-shell]').first()
  await expect(outer).toHaveAttribute('data-state', 'collapsed')
  await page
    .getByRole('navigation', { name: '品牌配置分区' })
    .getByRole('button', { name: '工作区布局' })
    .click()
  const canvas = page.locator('[data-brand-preview-viewport]')
  const previewShell = canvas.locator('[data-vean-app-shell]')
  const modes = [
    ['左侧菜单', 'sidebar'],
    ['顶部菜单', 'top'],
    ['双列侧栏', 'dual-vertical'],
    ['侧栏一级与顶部子菜单', 'vertical-horizontal'],
    ['顶部一级与侧栏子菜单', 'horizontal-vertical'],
    ['顶部一级与双列侧栏', 'horizontal-dual-vertical'],
  ] as const
  for (const [label, mode] of modes) {
    await page.getByRole('combobox', { name: '默认菜单模式' }).click()
    await page.getByRole('option', { name: label, exact: true }).click()
    await expect(previewShell).toHaveAttribute('data-mode', mode)
    await expect(previewShell).toHaveAttribute('data-state', 'expanded')
    const sidebar = canvas.locator('[data-sidebar="sidebar"]')
    if (mode === 'top') await expect(sidebar).toBeHidden()
    else {
      await expect(sidebar).toBeVisible()
      const marker = sidebar.getByText(mode === 'vertical-horizontal' ? '工作区' : '品牌定制', {
        exact: true,
      })
      await expect(marker).toBeVisible()
    }
    await expect(outer).toHaveAttribute('data-mode', 'sidebar')
    await expect(outer).toHaveAttribute('data-state', 'collapsed')
    await canvas.screenshot({ path: `/tmp/jingwei-brand-preview-${mode}.png` })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '展开实时预览' }).click()
  await expect(canvas).toBeVisible()
  const viewportBox = await canvas.boundingBox()
  if (!viewportBox) throw new Error('Responsive preview canvas is missing')
  expect(viewportBox.width).toBeLessThanOrEqual(390)
  expect(viewportBox.x).toBeGreaterThanOrEqual(0)
  expect(viewportBox.x + viewportBox.width).toBeLessThanOrEqual(390)
})

for (const variant of ['sidebar', 'floating', 'inset'] as const) {
  test(`${variant} sidebar saves personal preferences and pins the brand at the bottom`, async ({
    page,
  }) => {
    await page.goto('/account/me')
    const root = page.locator('[data-vean-app-shell]')
    await expect(page.locator('[data-vean-app-shell-logo][data-placement="sidebar"]')).toBeVisible()
    await page.getByRole('button', { name: '工作区设置', exact: true }).click()
    const label = variant === 'sidebar' ? '标准' : variant === 'floating' ? '悬浮' : '内嵌'
    await page.getByRole('tab', { name: label, exact: true }).click()
    await page.getByRole('tab', { name: '侧栏底部', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(root).toHaveAttribute('data-variant', variant)
    const brand = page.locator('[data-vean-app-shell-logo][data-placement="sidebar-bottom"]')
    await expect(brand).toBeVisible()
    await expect
      .poll(async () => {
        const brandBox = await brand.boundingBox()
        const sidebarBox = await page.locator('[data-sidebar="sidebar"]').boundingBox()
        if (!brandBox || !sidebarBox) return 1000
        return Math.abs(brandBox.y + brandBox.height - sidebarBox.y - sidebarBox.height)
      })
      .toBeLessThanOrEqual(1)
    await page.screenshot({ path: `/tmp/jingwei-sidebar-${variant}-bottom.png` })
    await page.locator('[data-vean-layout-trigger]').click()
    await expect(root).toHaveAttribute('data-state', 'collapsed')
    await expect(brand.locator('[data-global-brand-mark]')).toBeVisible()
    await expect(brand.locator('[data-global-brand-wordmark]')).toHaveCount(0)
    await page.reload()
    await expect(root).toHaveAttribute('data-variant', variant)
    await expect(brand).toBeVisible()
    await expect(root).toHaveAttribute('data-state', 'collapsed')
    await page.getByRole('button', { name: '工作区设置', exact: true }).click()
    await page.getByRole('button', { name: '恢复默认设置' }).click()
    await expect(root).toHaveAttribute('data-variant', 'sidebar')
    await expect(page.locator('[data-vean-app-shell-logo][data-placement="sidebar"]')).toBeVisible()
  })
}

test('brand draft previews native variants and bottom availability without altering the workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openBrandPreviewDraft(page, 'left')
  await page
    .getByRole('navigation', { name: '品牌配置分区' })
    .getByRole('button', { name: '工作区布局' })
    .click()
  const preview = page.locator('[data-brand-preview-viewport] [data-vean-app-shell]')
  const outer = page.locator('[data-vean-app-shell]').first()
  for (const [label, variant] of [
    ['悬浮', 'floating'],
    ['内嵌', 'inset'],
    ['标准', 'sidebar'],
  ] as const) {
    await page.getByRole('tab', { name: label, exact: true }).click()
    await expect(preview).toHaveAttribute('data-variant', variant)
    await expect(outer).toHaveAttribute('data-variant', 'sidebar')
  }
  await page.getByRole('tab', { name: '侧栏底部', exact: true }).click()
  await expect(
    preview.locator('[data-vean-app-shell-logo][data-placement="sidebar-bottom"]'),
  ).toBeVisible()
  await page.getByRole('combobox', { name: '默认菜单模式' }).click()
  await page.getByRole('option', { name: '顶部菜单', exact: true }).click()
  await expect(page.getByRole('tab', { name: '侧栏底部', exact: true })).toBeDisabled()
  await expect(preview.locator('[data-vean-app-shell-logo][data-placement="header"]')).toBeVisible()
  await page.getByRole('combobox', { name: '默认菜单模式' }).click()
  await page.getByRole('option', { name: '双列侧栏', exact: true }).click()
  await expect(
    preview.locator('[data-vean-app-shell-logo][data-placement="sidebar-bottom"]'),
  ).toBeVisible()
  await expect(outer.locator('[data-vean-app-shell-logo][data-placement="sidebar"]')).toBeVisible()
})

const insetBrand: BrandConfiguration = {
  ...defaultBrandConfiguration,
  workspaceDefaults: { ...defaultBrandConfiguration.workspaceDefaults, sidebarVariant: 'inset' },
  visualTheme: {
    ...defaultBrandConfiguration.visualTheme,
    overrides: {
      dark: defaultBrandConfiguration.visualTheme.overrides.dark,
      light: {
        background: { kind: 'LITERAL', value: 'hsl(240 5% 96%)' },
        sidebar: { kind: 'LITERAL', value: 'hsl(240 5% 96%)' },
        card: { kind: 'SIMPLE', value: 'white' },
      },
    },
  },
}

async function expectInsetBottomRadius(content: ReturnType<Page['locator']>): Promise<void> {
  await expect
    .poll(() =>
      content.evaluate((element) => {
        if (!element.parentElement) return { left: false, right: false }
        const parent = getComputedStyle(element.parentElement)
        const style = getComputedStyle(element)
        return {
          left:
            parseFloat(style.borderBottomLeftRadius) > 0 &&
            style.borderBottomLeftRadius === parent.borderBottomLeftRadius,
          right:
            parseFloat(style.borderBottomRightRadius) > 0 &&
            style.borderBottomRightRadius === parent.borderBottomRightRadius,
        }
      }),
    )
    .toEqual({ left: true, right: true })
}

test('inset workspace exposes both bottom corners with the footer hidden', async ({ page }) => {
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({
      json: publishedBrand({
        workspaceDefaults: insetBrand.workspaceDefaults,
        visualTheme: insetBrand.visualTheme,
      }),
    }),
  )
  await page.goto('/account/me')
  const root = page.locator('[data-vean-layout-root]')
  const content = root.locator('[data-vean-layout-content]')
  await expect(root).toHaveAttribute('data-variant', 'inset')
  await expect(root).toHaveAttribute('data-footer-visible', 'false')
  for (const viewport of [
    { width: 1600, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(content).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect
      .poll(() =>
        content.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const y = box.bottom - 1
          return [box.left + 1, box.right - 1].map(
            (x) =>
              document.elementFromPoint(x, y)?.closest('[data-vean-layout-content]') === element,
          )
        }),
      )
      .toEqual([false, false])
    await expectInsetBottomRadius(content)
  }
})

test('inset preview keeps bottom corners independently of the outer sidebar style', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openBrandPreviewDraft(page, 'left', insetBrand)
  const outer = page.locator('[data-vean-app-shell]').first()
  const preview = page.locator('[data-brand-preview-viewport] [data-vean-app-shell]')
  const content = preview.locator('[data-vean-layout-content]')
  await expect(outer).toHaveAttribute('data-variant', 'sidebar')
  await expect(preview).toHaveAttribute('data-variant', 'inset')
  await expectInsetBottomRadius(content)
  await page.screenshot({ path: '/tmp/jingwei-inset-preview-corners.png' })
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expectInsetBottomRadius(content)
})

test('brand title content shares the vertical center of its region at every placement', async ({
  page,
}) => {
  const assetUrl = `/api/v1/branding/assets/${id(990)}`
  await page.route(`**${assetUrl}`, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="24" viewBox="0 0 140 24"><rect x="0" y="2" width="140" height="20" fill="#6366f1"/></svg>',
    }),
  )
  let activeBrand = defaultEffectiveBrand
  await page.route('**/api/v1/branding/bootstrap*', (route) => route.fulfill({ json: activeBrand }))
  const forms: Partial<EffectiveBrand>[] = [
    { horizontalBrandMode: 'PLATFORM_WORDMARK' },
    { horizontalBrandMode: 'SHORT_NAME', shortName: '智能审核平台' },
    {
      horizontalBrandMode: 'CUSTOM_LOGO',
      logoUrl: assetUrl,
      logoContentType: 'image/svg+xml',
      logoColorMode: 'ORIGINAL',
    },
    {
      horizontalBrandMode: 'CUSTOM_LOGO',
      logoUrl: assetUrl,
      logoContentType: 'image/svg+xml',
      logoColorMode: 'FOLLOW_THEME',
    },
  ]
  for (const form of forms) {
    for (const brandPlacement of ['sider', 'sider-bottom', 'header'] as const) {
      activeBrand = publishedBrand({
        ...form,
        workspaceDefaults: {
          ...defaultEffectiveBrand.workspaceDefaults,
          sidebarVariant: 'inset',
          brandPlacement,
        },
      })
      await page.goto('/account/me')
      const brand = page.locator('[data-vean-app-shell-logo]')
      await expect(brand.locator('[data-global-brand-wordmark]')).toBeVisible()
      await expect
        .poll(() =>
          brand.evaluate((element) => {
            const row = element.getBoundingClientRect()
            const center = row.y + row.height / 2
            const children = [
              element.querySelector('[data-global-brand-mark]'),
              element.querySelector('[data-global-brand-wordmark]'),
              element.querySelector('[data-vean-app-shell-logo-title]'),
            ]
            return Math.max(
              ...children.map((child) => {
                if (!child) return 1000
                const box = child.getBoundingClientRect()
                return Math.abs(box.y + box.height / 2 - center)
              }),
            )
          }),
        )
        .toBeLessThanOrEqual(1)
    }
  }
})

test('preview wordmark is centered inside the sidebar title container', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openBrandPreviewDraft(page, 'left')
  const brand = page.locator('[data-brand-preview-viewport] [data-vean-app-shell-logo]')
  const title = brand.locator('[data-vean-app-shell-logo-title]')
  await expect(title.locator('svg')).toBeVisible()
  await expect
    .poll(() =>
      title.evaluate((element) => {
        const wordmark = element.querySelector('svg')?.getBoundingClientRect()
        if (!wordmark) return 1000
        const container = element.getBoundingClientRect()
        return Math.abs(wordmark.y + wordmark.height / 2 - container.y - container.height / 2)
      }),
    )
    .toBeLessThanOrEqual(0.5)
  await brand.screenshot({ path: '/tmp/jingwei-preview-wordmark-centered.png' })
})
