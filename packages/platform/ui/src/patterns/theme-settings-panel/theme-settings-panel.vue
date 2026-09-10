<script setup lang="ts">
import {
  builtinBasePresetKeys,
  builtinPrimaryPresetKeys,
  themeRadiusKeys,
  themeSizeKeys,
} from '@soybeanjs/theme'

import Button from '../../components/button/button.vue'
import { useTheme } from '../../components/config-provider/use-theme'

const theme = useTheme()

if (!theme) {
  throw new Error('ThemeSettingsPanel must be rendered inside ConfigProvider')
}

const { base, mode, primary, radius, resetPreset, size } = theme

const modes = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'auto' },
] as const

function resetTheme(): void {
  base.value = 'zinc'
  primary.value = 'indigo'
  radius.value = 'md'
  size.value = 'md'
  mode.value = 'light'
  resetPreset()
}
</script>

<template>
  <form class="grid gap-5" @submit.prevent>
    <label class="grid gap-2 text-sm font-medium text-foreground">
      显示模式
      <select v-model="mode" class="theme-setting-select">
        <option v-for="item in modes" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
    </label>

    <label class="grid gap-2 text-sm font-medium text-foreground">
      中性色
      <select v-model="base" class="theme-setting-select">
        <option v-for="item in builtinBasePresetKeys" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
    </label>

    <label class="grid gap-2 text-sm font-medium text-foreground">
      品牌色
      <select v-model="primary" class="theme-setting-select">
        <option v-for="item in builtinPrimaryPresetKeys" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
    </label>

    <div class="grid grid-cols-2 gap-4">
      <label class="grid gap-2 text-sm font-medium text-foreground">
        圆角
        <select v-model="radius" class="theme-setting-select">
          <option v-for="item in themeRadiusKeys" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>

      <label class="grid gap-2 text-sm font-medium text-foreground">
        尺寸
        <select v-model="size" class="theme-setting-select">
          <option v-for="item in themeSizeKeys" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>
    </div>

    <div class="flex justify-end border-t border-border pt-4">
      <Button type="button" variant="outline" @click="resetTheme">恢复默认</Button>
    </div>
  </form>
</template>

<style scoped>
.theme-setting-select {
  min-height: 2.5rem;
  border: 1px solid hsl(var(--input) / var(--input-alpha, 1));
  border-radius: var(--radius);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0 0.75rem;
  font: inherit;
}

.theme-setting-select:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>
