<script setup lang="ts">
import { SDialog } from '@soybeanjs/ui'
import { defineAsyncComponent, ref, type Component } from 'vue'

import Button from '../components/button/Button.vue'
const open = ref(false)
const ThemeCustomizerPanel = defineAsyncComponent<Component>(
  () => import('./ThemeCustomizerPanel.vue'),
)
</script>

<template>
  <SDialog
    v-model:open="open"
    class="min-w-0! w-[min(32rem,calc(100vw-2rem))]!"
    :show-fullscreen="false"
    title="外观设置"
    description="调整整个工作区的主题，设置会自动保存在当前浏览器。"
  >
    <template #trigger>
      <Button class="fixed bottom-4 right-4 z-40 shadow-lg" variant="outline">外观设置</Button>
    </template>
    <div class="max-h-[60dvh] overflow-y-auto p-1">
      <ThemeCustomizerPanel />
    </div>
    <template #footer>
      <Button @click="open = false">完成</Button>
    </template>
  </SDialog>
</template>
