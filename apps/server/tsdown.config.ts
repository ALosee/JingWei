import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  clean: true,
  dts: false,
  deps: {
    neverBundle: true,
    alwaysBundle: [/^@jingwei\//u],
    onlyBundle: false,
  },
})
