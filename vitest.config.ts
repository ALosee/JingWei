import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts', 'tooling/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
