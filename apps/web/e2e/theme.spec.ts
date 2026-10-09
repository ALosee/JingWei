import { expect, test, type Page } from '@playwright/test'

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
  await expect(page.locator('[data-vean-dialog-overlay]')).toHaveCount(0)
  await expectSettingsHeader(panel)
  await expect(panel.getByRole('separator')).toHaveCount(0)
  await expect(panel.locator('p')).toHaveCount(0)
  await expect(panel.getByRole('tablist', { name: '明暗模式' })).toBeVisible()
  await expect(panel.getByRole('tab', { name: '浅色', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.mouse.click(8, 8)
  await page.keyboard.press('Escape')
  await expect(panel).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('#vean-theme')).toHaveCount(1)
})

async function expectSettingsHeader(panel: ReturnType<Page['getByRole']>): Promise<void> {
  const title = await panel.getByRole('heading', { name: '工作区设置' }).boundingBox()
  const tabs = await panel.getByRole('tablist').first().boundingBox()
  const bounds = await panel.boundingBox()
  if (!title || !tabs || !bounds) throw new Error('Settings header has no visible bounds')
  expect(Math.abs(title.y + title.height / 2 - (tabs.y + tabs.height / 2))).toBeLessThan(2)
  expect(title.x + title.width).toBeLessThan(tabs.x)
  expect(bounds.x + bounds.width - (tabs.x + tabs.width)).toBeLessThan(24)
}

test('theme mode segment follows system changes and persists the auto preference', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  const modes = page.getByRole('tablist', { name: '明暗模式' })
  await modes.getByRole('tab', { name: '自动', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(modes.getByRole('tab', { name: '自动', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await expect(page.getByRole('tab', { name: '自动', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
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

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '深色', exact: true }).click()
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
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '深色', exact: true }).click()
  await expect(surface).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.reload()
  await expect(surface).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '浅色', exact: true }).click()
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

test('mobile settings stay within viewport and reset persisted preferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/account/me')
  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await expectSettingsHeader(page.getByRole('dialog', { name: '工作区设置' }))
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
  await page.getByRole('tab', { name: '布局设置' }).click()
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
  await expect(page.locator('[data-vean-layout-header]')).toHaveCSS('height', '72px')

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
  const tabs = page.getByRole('navigation', { name: '页面标签' })

  await expect(sidebarWrapper).toHaveCSS('border-inline-end-width', '1px')
  await expect(sidebar).toHaveCSS('border-inline-end-width', '0px')
  await expect(header).toHaveCSS('border-bottom-width', '1px')
  await expect(tabs).toHaveCSS('border-top-width', '0px')
  await expect(tabs).toHaveCSS('border-bottom-width', '1px')
})

test('brand keeps distinct header and sider behavior', async ({ page }) => {
  await page.goto('/account/me')
  const sidebarWrapper = page.locator('[data-vean-layout-sidebar] > div:nth-child(2)')
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

  await page
    .getByRole('button', { name: '切换侧边栏' })
    .and(page.locator('[data-vean-layout-trigger]'))
    .click()
  await expect(page.locator('[data-vean-layout-root]')).toHaveAttribute('data-state', 'collapsed')
  await expect(headerBrandLink.locator('[data-global-brand-wordmark]')).toBeVisible()
  await expect
    .poll(async () => headerBrandRegion.evaluate((element) => element.clientWidth))
    .toBe(expandedBrandWidth)
  await page
    .getByRole('button', { name: '切换侧边栏' })
    .and(page.locator('[data-vean-layout-trigger]'))
    .click()

  await page.getByRole('button', { name: '工作区设置', exact: true }).click()
  await page.getByRole('tab', { name: '布局设置' }).click()
  await page.getByRole('tab', { name: '侧栏', exact: true }).click()

  const siderBrandRegion = page.locator('[data-global-brand-region="sider"]')
  await expect(siderBrandRegion).toBeVisible()
  await expect(headerBrandRegion).toHaveCount(0)
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
    .getByRole('navigation', { name: '主导航' })
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

test('left layout places a header brand above both sider and content', async ({ page }) => {
  await page.goto('/account/me')
  const root = page.locator('[data-vean-layout-root]')
  const header = page.locator('[data-vean-layout-header]')
  const sider = page.locator('[data-sidebar="sidebar"]')
  const content = page.locator('[data-vean-layout-content]')

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
  await expect(page.getByRole('navigation', { name: '顶部导航' })).toBeVisible()
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
  const navigation = page.getByRole('navigation', { name: '顶部导航' })
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
    .getByRole('navigation', { name: '顶部导航' })
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
  const navigation = page.getByRole('navigation', { name: '顶部导航' })
  const trigger = navigation.getByRole('button', { name: '系统管理' })
  await expect(trigger).toHaveAttribute('data-child-selected', '')
  await expect(navigation.locator('[data-vean-tree-nav]')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  )
  await expect(navigation.locator('[data-vean-tree-nav]')).toHaveCSS('border-top-width', '0px')
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
  const navigation = page.getByRole('navigation', { name: '顶部导航' })
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

test('TreeNav remains operable in the compact mobile header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const system = topNavigationContainer(900, 'top.system', '系统管理')
  const nestedAccount = { ...account, parentId: system.id }
  const alias = {
    ...nestedAccount,
    id: id(901),
    code: 'iam.roles',
    name: '角色权限',
    routeKey: 'iam.roles',
    path: '/roles',
    params: {},
    accessMode: 'PERMISSION' as const,
  }
  await prepareTopNavigation(page, [login, system, nestedAccount, alias])
  const navigation = page.getByRole('navigation', { name: '顶部导航' })
  const buttons = navigation.getByRole('button')
  await expect(buttons.first()).toBeVisible()
  const triggerBox = await buttons.first().boundingBox()
  if (triggerBox === null) throw new Error('Mobile TreeNav has no visible trigger')
  expect(triggerBox.x).toBeGreaterThanOrEqual(0)
  expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(390)
  await buttons.first().click()
  const more = navigation.getByRole('button', { name: '更多' })
  if (await more.count())
    await page.getByRole('menuitem', { name: '系统管理', exact: true }).click()
  await page.getByRole('menuitem', { name: '角色权限', exact: true }).click()
  await expect(page).toHaveURL(/\/roles$/)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(buttons.first()).toHaveAttribute('data-child-selected', '')
})
