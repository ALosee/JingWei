<script setup lang="ts">
import { ref } from 'vue'

import { Button, Dialog, ThemeSettingsPanel } from '@jingwei/ui'

const open = ref(false)
</script>

<template>
  <Dialog
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
      <ThemeSettingsPanel />
    </div>
    <template #footer>
      <Button @click="open = false">完成</Button>
    </template>
  </Dialog>
</template>
