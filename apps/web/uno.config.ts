import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      border: 'var(--jw-color-border)',
      danger: 'var(--jw-color-danger)',
      'danger-active': 'var(--jw-color-danger-active)',
      'danger-hover': 'var(--jw-color-danger-hover)',
      foreground: 'var(--jw-color-text)',
      'on-danger': 'var(--jw-color-on-danger)',
      'on-primary': 'var(--jw-color-on-brand)',
      primary: 'var(--jw-color-brand)',
      'primary-active': 'var(--jw-color-brand-active)',
      'primary-hover': 'var(--jw-color-brand-hover)',
      ring: 'var(--jw-color-focus-ring)',
      subtle: 'var(--jw-color-subtle)',
      'subtle-active': 'var(--jw-color-subtle-active)',
      'subtle-hover': 'var(--jw-color-subtle-hover)',
      surface: 'var(--jw-color-surface)',
    },
  },
})
