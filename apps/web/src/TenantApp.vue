<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { activeBrand } from '@jingwei/module-branding/web'
import { ConfigProvider } from '@jingwei/ui'

import { tenantThemeOptions } from './appearance/tenant-theme.js'
import TenantThemeController from './appearance/TenantThemeController.vue'
import { useAppearanceStore } from './stores/appearance.js'

const appearance = useAppearanceStore()
const { preferences } = storeToRefs(appearance)
const theme = computed(() =>
  tenantThemeOptions(activeBrand.value.visualTheme, preferences.value.size),
)
</script>

<template>
  <ConfigProvider :theme="theme" locale="zh-CN">
    <TenantThemeController />
    <RouterView />
  </ConfigProvider>
</template>
