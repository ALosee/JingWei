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

    <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-5">
      <h2 class="m-0 whitespace-nowrap text-base text-foreground font-650 sm:text-lg">
        工作区设置
      </h2>
      <Tabs
        v-model="activeTab"
        class="contents"
        :items="tabs"
        :ui="{ list: 'justify-self-end', content: 'col-span-2 mt-0 min-w-0' }"
        size="sm"
        fill="auto"
        activation-mode="manual"
      >
        <template #content="{ value }">
          <AppearanceSettings v-if="value === 'appearance'" />
          <LayoutSettings v-else />
        </template>
      </Tabs>
    </div>
  </Popover>
</template>
