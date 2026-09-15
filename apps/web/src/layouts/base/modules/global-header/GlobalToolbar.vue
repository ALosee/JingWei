<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { ButtonIcon } from '@jingwei/ui'

import { resolveHomeTarget } from '../../../../navigation/workspace-targets.js'
import { useShellStore } from '../../../../stores/shell.js'
import GlobalSettingsPopover from '../global-settings/GlobalSettingsPopover.vue'
import MenuSearchPopover from './MenuSearchPopover.vue'
import UserAccountMenu from './UserAccountMenu.vue'

const { isFullscreen, isSupported, toggle: toggleFullscreen } = useFullscreen()
const router = useRouter()
const shell = useShellStore()
const homePath = computed(() => resolveHomeTarget(shell.navigation))

function goHome(): void {
  void router.push(homePath.value)
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5" aria-label="工作区功能区">
    <ButtonIcon icon="lucide:house" variant="ghost" aria-label="回到默认首页" @click="goHome" />
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
