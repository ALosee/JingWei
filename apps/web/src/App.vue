<script setup lang="ts">
import { ConfigProvider } from '@jingwei/ui'
</script>

<template>
  <ConfigProvider persist-theme locale="zh-CN">
    <RouterView />
  </ConfigProvider>
</template>
