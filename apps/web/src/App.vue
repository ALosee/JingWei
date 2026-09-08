<script setup lang="ts">
import { SConfigProvider, ThemeSettings } from '@jingwei/ui'
</script>

<template>
  <SConfigProvider persist-theme locale="zh-CN">
    <RouterView />
    <ThemeSettings />
  </SConfigProvider>
</template>
