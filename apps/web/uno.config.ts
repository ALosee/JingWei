import { fileURLToPath } from 'node:url'

import { presetSbean } from '@soybeanjs/ui-uno'
import { presetSoybean } from '@soybeanjs/unocss-preset'
import { defineConfig } from 'unocss'

const uiRoot = fileURLToPath(new URL('../../packages/platform/ui/', import.meta.url))

export default defineConfig({
  content: {
    pipeline: {
      include: [/\.(vue|[jt]sx?)($|\?)/],
      exclude: [/node_modules\//, /\.git\//],
    },
    filesystem: [`${uiRoot}src/**/*.{vue,ts,tsx}`],
  },
  presets: [
    presetSoybean(),
    presetSbean({
      cwd: uiRoot,
      overrides: {
        globalCSS: true,
        resetCSS: true,
      },
    }),
  ],
})
