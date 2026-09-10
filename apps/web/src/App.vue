<script setup lang="ts">
import { ConfigProvider } from '@jingwei/ui'

import AppThemeSettings from './components/app-theme-settings.vue'
</script>

<template>
  <ConfigProvider persist-theme locale="zh-CN">
    <RouterView />
    <AppThemeSettings />
  </ConfigProvider>
</template>
