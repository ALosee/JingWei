import { fileURLToPath } from 'node:url'

import { presetSoybean } from '@soybeanjs/unocss-preset'
import { buildSemanticColors, presetVean } from '@vean/unocss'
import { defineConfig } from 'unocss'

import { buildThemeBodyCss, withThemeColorAlpha } from '@jingwei/ui/theme-unocss'

const uiRoot = fileURLToPath(new URL('../../packages/platform/ui/', import.meta.url))

export default defineConfig({
  // Explicit native mappings replace any previous dev configuration; alpha is
  // composed only after UnoCSS has resolved its <alpha-value> placeholder.
  theme: { colors: buildSemanticColors() },
  configDeps: [`${uiRoot}src/theme/semantic-colors.ts`],
  preflights: [{ getCSS: () => buildThemeBodyCss() }],
  postprocess: (utility) => {
    for (const entry of utility.entries) {
      if (typeof entry[1] === 'string') entry[1] = withThemeColorAlpha(entry[1])
    }
  },
  content: {
    pipeline: {
      include: [/\.(vue|[jt]sx?)($|\?)/],
      exclude: [/node_modules\//, /\.git\//],
    },
    filesystem: [`${uiRoot}src/**/*.{vue,ts,tsx}`],
  },
  presets: [
    presetSoybean(),
    presetVean({
      cwd: uiRoot,
      overrides: {
        globalCSS: true,
        resetCSS: true,
      },
    }),
  ],
})
