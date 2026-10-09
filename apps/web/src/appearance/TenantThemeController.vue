<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useTheme } from '@jingwei/ui'

import { useAppearanceStore } from '../stores/appearance.js'

const theme = useTheme()
if (theme === null) throw new Error('TenantThemeController requires ConfigProvider')

const appearance = useAppearanceStore()
const { preferences } = storeToRefs(appearance)

watch(
  () => preferences.value.mode,
  (mode) => theme.setMode(mode),
  { immediate: true },
)

watch(theme.mode, (mode) => {
  if (mode !== preferences.value.mode) appearance.patch({ mode })
})
</script>

<template><span v-if="false" /></template>
