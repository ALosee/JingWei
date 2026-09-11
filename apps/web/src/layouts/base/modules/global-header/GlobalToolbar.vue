<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { navigationTarget } from '@jingwei/module-navigation/shared'
import { ButtonIcon } from '@jingwei/ui'

import { useShellStore } from '../../../../stores/shell.js'
import GlobalSettingsPopover from '../global-settings/GlobalSettingsPopover.vue'
import MenuSearchPopover from './MenuSearchPopover.vue'

const shell = useShellStore()
const avatarFailed = ref(false)
const { isFullscreen, isSupported, toggle: toggleFullscreen } = useFullscreen()
const accountTarget = computed(() => {
  const account = shell.navigation?.nodes.find((node) => node.routeKey === 'iam.account')
  return account === undefined ? null : navigationTarget(account)
})
const avatarUrl = computed(() => {
  const value = shell.currentUser?.avatarUrl
  if (value === null || value === undefined || typeof window === 'undefined') return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
})
const initial = computed(() => {
  const value = shell.currentUser?.displayName.trim().charAt(0).toLocaleUpperCase()
  return value === undefined || value === '' ? '用' : value
})

watch(avatarUrl, () => {
  avatarFailed.value = false
})
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

    <RouterLink
      v-if="accountTarget"
      :to="accountTarget"
      class="ms-1 inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-foreground decoration-none hover:bg-accent"
    >
      <img
        v-if="avatarUrl && !avatarFailed"
        :src="avatarUrl"
        alt=""
        class="size-8 shrink-0 rounded-full object-cover"
        referrerpolicy="no-referrer"
        @error="avatarFailed = true"
      />
      <span
        v-else
        aria-hidden="true"
        class="size-8 grid shrink-0 place-items-center rounded-full bg-primary/12 text-primary font-700"
      >
        {{ initial }}
      </span>
      <span class="max-w-36 truncate text-sm lt-sm:hidden">
        {{ shell.currentUser?.displayName ?? '当前用户' }}
      </span>
    </RouterLink>
    <div v-else class="ms-1 inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1">
      <span
        aria-hidden="true"
        class="size-8 grid shrink-0 place-items-center rounded-full bg-primary/12 text-primary font-700"
      >
        {{ initial }}
      </span>
      <span class="max-w-36 truncate text-sm lt-sm:hidden">
        {{ shell.currentUser?.displayName ?? '当前用户' }}
      </span>
    </div>
  </div>
</template>
