import vue from '@vitejs/plugin-vue'
import ElegantRouter from 'elegant-router/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

import { createThemeInitScript } from '@jingwei/ui/theme-init'

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
        return [{ tag: 'script', children: createThemeInitScript(), injectTo: 'head-prepend' }]
      },
    },
  ],
  build: {
    rolldownOptions: {
      treeshake: {
        // SoybeanUI 0.30.0's barrel imports every component but omits sideEffects metadata.
        // Only its JS component modules are declarative; CSS must retain side effects.
        moduleSideEffects: (id) => !/\/@soybeanjs\/ui\/dist\/.*\.js$/.test(id),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
