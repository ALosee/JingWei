<script setup lang="ts">
import { ref } from 'vue'

import { ButtonIcon, Popover, Tabs } from '@jingwei/ui'

import AppearanceSettings from './AppearanceSettings.vue'
import LayoutSettings from './LayoutSettings.vue'

const activeTab = ref<'appearance' | 'layout'>('appearance')
const tabs = [
  { value: 'appearance', label: '外观设置' },
  { value: 'layout', label: '布局设置' },
]
const sectionTabsUi = {
  list: 'w-full justify-start gap-2 rounded-none border-b border-border bg-transparent p-0',
  trigger:
    'flex-none rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none',
  content: 'mt-0',
}
</script>

<template>
  <Popover
    :modal="false"
    :show-arrow="false"
    placement="bottom-end"
    class="max-h-[calc(100vh-5rem)] w-[min(28rem,calc(100vw-1rem))] overflow-y-auto p-4"
    :popup-props="{ 'aria-label': '工作区设置' }"
  >
    <template #trigger>
      <ButtonIcon icon="lucide:settings" variant="ghost" aria-label="工作区设置" />
    </template>

    <header class="mb-5">
      <h2 class="m-0 text-lg text-foreground font-650">工作区设置</h2>
      <p class="mb-0 mt-1 text-xs text-muted-foreground">
        个人调整会按当前租户和账号保存在本浏览器。
      </p>
    </header>
    <Tabs
      v-model="activeTab"
      class="w-full"
      :items="tabs"
      :ui="sectionTabsUi"
      :enable-indicator="false"
      fill="auto"
      activation-mode="manual"
    >
      <template #content="{ value }">
        <div class="min-w-0 px-1 pt-4">
          <AppearanceSettings v-if="value === 'appearance'" />
          <LayoutSettings v-else />
        </div>
      </template>
    </Tabs>
  </Popover>
</template>
