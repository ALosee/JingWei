<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'

import { ButtonIcon } from '@jingwei/ui'

import GlobalSettingsPopover from '../global-settings/GlobalSettingsPopover.vue'
import MenuSearchPopover from './MenuSearchPopover.vue'
import UserAccountMenu from './UserAccountMenu.vue'

const { isFullscreen, isSupported, toggle: toggleFullscreen } = useFullscreen()
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5" aria-label="工作区功能区">
    <MenuSearchPopover />
    <ButtonIcon
      :icon="isFullscreen ? 'lucide:minimize' : 'lucide:maximize'"
      variant="ghost"
      :disabled="!isSupported"
      :aria-label="isFullscreen ? '退出全屏' : '进入全屏'"
      @click="toggleFullscreen"
    />
    <GlobalSettingsPopover />
    <UserAccountMenu />
  </div>
</template>
