<script setup lang="ts">
import { ButtonIcon, Popover } from '@jingwei/ui'

import WorkspaceSettings from './WorkspaceSettings.vue'
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

    <div class="grid gap-4">
      <h2 class="m-0 whitespace-nowrap text-base text-foreground font-650 sm:text-lg">
        工作区设置
      </h2>
      <WorkspaceSettings />
    </div>
  </Popover>
</template>
