import vue from '@vitejs/plugin-vue'
import ElegantRouter from 'elegant-router/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // Keep every app on the repository-level environment contract.
  envDir: '../..',
  plugins: [vue(), ElegantRouter()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
