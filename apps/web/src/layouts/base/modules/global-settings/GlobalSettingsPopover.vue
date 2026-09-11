<script setup lang="ts">
import { ref } from 'vue'

import { ButtonIcon, Popover, Tabs, ThemeSettingsPanel } from '@jingwei/ui'

import LayoutSettings from './LayoutSettings.vue'

const activeTab = ref<'theme' | 'layout'>('theme')
const tabs = [
  { value: 'theme', label: '主题设置' },
  { value: 'layout', label: '布局设置' },
]
</script>

<template>
  <Popover
    :modal="false"
    :show-arrow="false"
    placement="bottom-end"
    class="max-h-[calc(100vh-5rem)] w-[min(26rem,calc(100vw-1rem))] overflow-y-auto p-4"
    :popup-props="{ 'aria-label': '工作区设置' }"
  >
    <template #trigger>
      <ButtonIcon icon="lucide:settings" variant="ghost" aria-label="工作区设置" />
    </template>

    <header class="mb-5">
      <h2 class="m-0 text-lg text-foreground font-650">工作区设置</h2>
      <p class="mb-0 mt-1 text-xs text-muted-foreground">外观和布局设置会保存在当前浏览器。</p>
    </header>
    <Tabs v-model="activeTab" class="w-full" :items="tabs" fill="full" activation-mode="manual">
      <template #content="{ value }">
        <div class="min-w-0 p-1">
          <ThemeSettingsPanel v-if="value === 'theme'" />
          <LayoutSettings v-else />
        </div>
      </template>
    </Tabs>
  </Popover>
</template>
