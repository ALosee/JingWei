import { expect, test } from '@playwright/test'

import { THEME_STORAGE_KEY as storageKey } from '@jingwei/ui/theme-init'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, body: '{}' }))
})

test('theme settings work on recovery pages and persist across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '外观设置', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('combobox', { name: '显示模式' }).selectOption('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('dialog').click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: '外观设置', exact: true })).toBeFocused()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('#__SoybeanUI_theme')).toHaveCount(1)
})

test('restores palette, radius and global size and follows system changes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '外观设置', exact: true })).toBeVisible()
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
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('font-size', '18px')
  await expect(page.getByRole('button', { name: '外观设置', exact: true })).toHaveCSS(
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

test('invalid persisted theme falls back to a usable settings panel', async ({ page }) => {
  await page.addInitScript(({ key }) => localStorage.setItem(key, '{broken'), { key: storageKey })
  await page.goto('/')
  await page.getByRole('button', { name: '外观设置', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
})

test('mobile settings stay within viewport and reset persisted preferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '外观设置', exact: true }).click()
  await page.getByRole('combobox', { name: '显示模式' }).selectOption('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: '恢复默认', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  const dialog = await page.getByRole('dialog').boundingBox()
  if (!dialog) throw new Error('Theme dialog has no visible bounds')
  expect(dialog.x).toBeGreaterThanOrEqual(0)
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})
