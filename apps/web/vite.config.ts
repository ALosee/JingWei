import vue from '@vitejs/plugin-vue'
import ElegantRouter from 'elegant-router/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

import { createAppearanceModeInitScript } from './src/appearance/mode-init.js'

export default defineConfig({
  // Keep every app on the repository-level environment contract.
  envDir: '../..',
  plugins: [
    vue(),
    UnoCSS(),
    ElegantRouter(),
    {
      name: 'jingwei-theme-init',
      transformIndexHtml() {
        return [
          { tag: 'script', children: createAppearanceModeInitScript(), injectTo: 'head-prepend' },
        ]
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
