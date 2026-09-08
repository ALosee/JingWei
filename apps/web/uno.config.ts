import { fileURLToPath } from 'node:url'

import { presetSbean } from '@soybeanjs/ui-uno'
import { presetSoybean } from '@soybeanjs/unocss-preset'
import { defineConfig } from 'unocss'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  content: {
    pipeline: {
      include: [/\.(vue|[jt]sx?)($|\?)/],
      exclude: [/node_modules\/(?!.*@soybeanjs\/ui\/dist\/)/, /\.git\//],
    },
    filesystem: [`${workspaceRoot}packages/platform/ui/node_modules/@soybeanjs/ui/dist/**/*.js`],
  },
  presets: [
    presetSoybean(),
    presetSbean({
      cwd: workspaceRoot,
      overrides: {
        globalCSS: true,
        resetCSS: true,
      },
    }),
  ],
})
