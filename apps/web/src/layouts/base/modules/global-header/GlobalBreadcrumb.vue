<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { navigationTarget } from '@jingwei/module-navigation/shared'
import { Breadcrumb, type BreadcrumbOptionData } from '@jingwei/ui'

import { navigationBreadcrumbs } from '../../../../navigation/presentation.js'
import { useShellStore } from '../../../../stores/shell.js'

const route = useRoute()
const shell = useShellStore()
const items = computed<BreadcrumbOptionData[]>(() => {
  const breadcrumbs = navigationBreadcrumbs(
    shell.navigation?.nodes ?? [],
    route.meta.navigationCode,
  )
  return breadcrumbs.map((node, index) => {
    const item = { label: node.name }
    if (node.type !== 'MENU' || index === breadcrumbs.length - 1) return item
    return { ...item, to: navigationTarget(node) ?? '/__recovery' }
  })
})
</script>

<template>
  <Breadcrumb class="min-w-0 flex-1 overflow-hidden" :items="items" ellipsis />
</template>
