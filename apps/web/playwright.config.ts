import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(process.env.PLAYWRIGHT_CHANNEL === undefined
      ? {}
      : { channel: process.env.PLAYWRIGHT_CHANNEL }),
  },
  webServer: {
    command: 'pnpm preview --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: true,
  },
})
