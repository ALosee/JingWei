<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { Menubar } from '@jingwei/ui'

import { activeNavigationMenuCode } from '../../../../navigation/presentation.js'
import { useShellStore } from '../../../../stores/shell.js'
import { layoutTargetIds } from '../../layout-targets.js'
import { useTeleportTarget } from '../../use-teleport-target.js'
import { createHeaderMenuItems } from './navigation-menu-items.js'

const shell = useShellStore()
const route = useRoute()
const target = useTeleportTarget(layoutTargetIds.headerMenu)
const items = computed(() => createHeaderMenuItems(shell.navigation?.nodes ?? []))
const activeValue = computed(() =>
  activeNavigationMenuCode(shell.navigation?.nodes ?? [], route.meta.navigationCode),
)
</script>

<template>
  <Teleport v-if="target" :to="target">
    <nav class="min-w-0 flex-1 overflow-hidden" aria-label="顶部导航">
      <Menubar
        class="max-w-full"
        :items="items"
        :active-value="activeValue"
        trigger="hover"
        collapsible
        more-label="更多"
        more-icon="lucide:ellipsis"
      />
    </nav>
  </Teleport>
</template>
