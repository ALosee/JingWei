import { defineConfig } from 'elegant-router'

import { enabledPageDirs } from './src/generated/elegant-router.js'

export default defineConfig({
  pageDir: [...enabledPageDirs],
  routerGeneratedDir: 'src/router/_generated',
  dts: 'src/router/_generated/elegant-router.d.ts',
  // Jingwei owns runtime names; avoid Elegant Router's filesystem-name augmentation.
  vueRouterDts: 'node_modules/.cache/jingwei/typed-router.d.ts',
  layouts: {
    base: 'src/layouts/BaseLayout.vue',
    blank: 'src/layouts/BlankLayout.vue',
  },
  rootRedirect: '/__bootstrap',
  generateBuiltinRoutes: false,
})
