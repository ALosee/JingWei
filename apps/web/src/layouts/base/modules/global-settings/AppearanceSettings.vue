<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { Button, Segment, Select, Separator } from '@jingwei/ui'
import type { SegmentOptionData, SelectSingleOptionData } from '@jingwei/ui'

import {
  themeSizePreferences,
  useAppearanceStore,
  type ThemeModePreference,
  type ThemeSizePreference,
} from '../../../../stores/appearance.js'

const appearance = useAppearanceStore()
const { preferences } = storeToRefs(appearance)

const modeOptions: SegmentOptionData<ThemeModePreference>[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'auto', label: '跟随系统' },
]
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

function setMode(value: ThemeModePreference | null): void {
  if (value !== null) appearance.patch({ mode: value })
}

function setSize(value: unknown): void {
  if (themeSizePreferences.some((size) => size === value))
    appearance.patch({ size: value as ThemeSizePreference })
}
</script>

<template>
  <form class="grid gap-6 pt-2" @submit.prevent>
    <p class="m-0 text-xs text-muted-foreground">
      品牌颜色和组件圆角由租户统一发布；你可以调整明暗模式和显示尺寸。
    </p>

    <section class="grid gap-3">
      <Separator align="center">明暗模式</Separator>
      <Segment
        :model-value="preferences.mode"
        :items="modeOptions"
        size="sm"
        fill="full"
        @update:model-value="setMode"
      />
    </section>

    <section class="grid gap-3">
      <Separator align="center">显示尺寸</Separator>
      <div class="flex items-center justify-between gap-4 px-1">
        <span class="text-sm text-foreground">界面密度</span>
        <Select
          :model-value="preferences.size"
          :items="sizeOptions"
          class="w-36"
          @update:model-value="setSize"
        />
      </div>
    </section>

    <div class="flex justify-start border-t border-border pt-4">
      <Button type="button" variant="outline" size="sm" @click="appearance.reset">
        恢复外观默认值
      </Button>
    </div>
  </form>
</template>
