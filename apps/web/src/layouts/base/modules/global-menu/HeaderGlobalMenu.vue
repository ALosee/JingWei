<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { TreeNav, type TreeNavProps } from '@jingwei/ui'

import { activeNavigationMenuCode } from '../../../../navigation/presentation.js'
import { useShellStore } from '../../../../stores/shell.js'
import { layoutTargetIds } from '../../layout-targets.js'
import { useTeleportTarget } from '../../use-teleport-target.js'
import { createHeaderMenuItems } from './navigation-menu-items.js'

const shell = useShellStore()
const route = useRoute()
const target = useTeleportTarget(layoutTargetIds.headerMenu)
const items = computed(() => createHeaderMenuItems(shell.navigation?.nodes ?? []))
const selectedValue = computed(() =>
  activeNavigationMenuCode(shell.navigation?.nodes ?? [], route.meta.navigationCode),
)
const menuUi = {
  overflow: 'min-w-0 w-full',
  root: 'h-10 rounded-none! bg-transparent! p-0! gap-1! border-none shadow-none',
  item: 'h-9 px-3 rounded-md',
} satisfies NonNullable<TreeNavProps['ui']>
</script>

<template>
  <Teleport v-if="target" :to="target">
    <nav class="min-w-0 flex-1 overflow-hidden" aria-label="顶部导航">
      <TreeNav
        class="max-w-full"
        :items="items"
        :model-value="selectedValue"
        :ui="menuUi"
        as="div"
        trigger="hover"
        :delay-duration="150"
        :skip-delay-duration="300"
        collapsible
        more-label="更多"
        more-icon="lucide:ellipsis"
      />
    </nav>
  </Teleport>
</template>
