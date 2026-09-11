<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { TreeMenu } from '@jingwei/ui'

import { activeNavigationMenuCode } from '../../../../navigation/presentation.js'
import { useLayoutStore } from '../../../../stores/layout.js'
import { useShellStore } from '../../../../stores/shell.js'
import { layoutTargetIds } from '../../layout-targets.js'
import { useTeleportTarget } from '../../use-teleport-target.js'
import { createSiderMenuItems } from './navigation-menu-items.js'

const shell = useShellStore()
const layout = useLayoutStore()
const route = useRoute()
const { preferences } = storeToRefs(layout)
const isMobile = useMediaQuery('(max-width: 767px)')
const target = useTeleportTarget(layoutTargetIds.siderMenu)
const items = computed(() => createSiderMenuItems(shell.navigation?.nodes ?? []))
const activeValue = computed(() =>
  activeNavigationMenuCode(shell.navigation?.nodes ?? [], route.meta.navigationCode),
)
const collapsed = computed(() => !isMobile.value && preferences.value.siderCollapsed)
</script>

<template>
  <Teleport v-if="target" :to="target">
    <nav class="h-full min-h-0" aria-label="主导航">
      <TreeMenu
        :model-value="activeValue"
        :items="items"
        :collapsed="collapsed"
        :collapsed-width="64"
        expand-strategy="active"
      />
    </nav>
  </Teleport>
</template>
