<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { Button, Select, ThemeModeSegment } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import {
  themeSizePreferences,
  useAppearanceStore,
  type ThemeSizePreference,
} from '../../../../stores/appearance.js'

const appearance = useAppearanceStore()
const { preferences } = storeToRefs(appearance)

const sizeLabels: Record<ThemeSizePreference, string> = {
  xs: '紧凑',
  sm: '偏小',
  md: '标准',
  lg: '偏大',
  xl: '大',
  '2xl': '特大',
}
const sizeOptions: SelectSingleOptionData<ThemeSizePreference>[] = themeSizePreferences.map(
  (value) => ({ value, label: sizeLabels[value] }),
)

function setSize(value: unknown): void {
  if (themeSizePreferences.some((size) => size === value))
    appearance.patch({ size: value as ThemeSizePreference })
}
</script>

<template>
  <form class="grid gap-4" @submit.prevent>
    <div class="flex items-center justify-between gap-4">
      <span id="appearance-mode-label" class="text-sm text-foreground">明暗模式</span>
      <ThemeModeSegment size="sm" :list-props="{ 'aria-labelledby': 'appearance-mode-label' }" />
    </div>

    <div class="flex items-center justify-between gap-4">
      <label for="appearance-size" class="text-sm text-foreground">界面密度</label>
      <Select
        id="appearance-size"
        :model-value="preferences.size"
        :items="sizeOptions"
        class="w-36"
        @update:model-value="setSize"
      />
    </div>

    <div class="flex justify-start">
      <Button type="button" variant="outline" size="sm" @click="appearance.reset">
        恢复外观默认值
      </Button>
    </div>
  </form>
</template>
