<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { ButtonIcon } from '@jingwei/ui'

import { useAppearanceStore, type ThemeModePreference } from '../../../../stores/appearance.js'

const appearance = useAppearanceStore()
const { preferences } = storeToRefs(appearance)
const modes: Record<
  ThemeModePreference,
  { label: string; icon: string; next: ThemeModePreference }
> = {
  auto: { label: '跟随系统', icon: 'lucide:monitor', next: 'light' },
  light: { label: '白天模式', icon: 'lucide:sun', next: 'dark' },
  dark: { label: '黑夜模式', icon: 'lucide:moon', next: 'auto' },
}
const mode = computed(() => modes[preferences.value.mode])
const label = computed(
  () => `明暗模式：${mode.value.label}，点击切换到${modes[mode.value.next].label}`,
)

function cycleMode(): void {
  appearance.patch({ mode: mode.value.next })
}
</script>

<template>
  <ButtonIcon
    :icon="mode.icon"
    variant="ghost"
    :aria-label="label"
    :title="label"
    @click="cycleMode"
  />
</template>
