<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { PageTabs, type PageTabsOptionData } from '@jingwei/ui'

interface TabMeta {
  /** Last concrete location for this page, including query/hash. */
  fullPath: string
  label: string
}

/**
 * PageTabs closes a single tab by splicing the items array in place.
 * `items` must therefore be a stable reactive array we own — a computed
 * map would hand out a fresh array that close cannot persist.
 */
const route = useRoute()
const router = useRouter()
const items = ref<PageTabsOptionData[]>([])
const metaByPath = new Map<string, TabMeta>()
const activeValue = ref('')
const pageTabsUi = {
  root: 'h-full min-w-max items-end px-2',
  item: 'h-8',
} as const

function resolveLabel(): string {
  if (typeof route.meta.title === 'string' && route.meta.title !== '') return route.meta.title
  if (typeof route.name === 'string' && route.name !== '') return route.name
  return route.path
}

watch(
  () => route.fullPath,
  () => {
    // Identity is path only so query/hash changes reuse the same tab.
    const path = route.path
    const label = resolveLabel()
    metaByPath.set(path, { fullPath: route.fullPath, label })
    const index = items.value.findIndex((item) => item.value === path)
    const next: PageTabsOptionData = {
      value: path,
      label,
      hidePinnedIcon: true,
      draggable: false,
    }
    if (index >= 0) items.value[index] = next
    else items.value.push(next)
    activeValue.value = path
  },
  { immediate: true },
)

watch(activeValue, async (path) => {
  if (path === '' || path === route.path) return
  const target = metaByPath.get(path)?.fullPath ?? path
  if (target !== route.fullPath) await router.push(target)
})

function beforeClose(): boolean {
  return items.value.length > 1
}
</script>

<template>
  <nav class="h-full w-full overflow-x-auto border-b border-border bg-card" aria-label="页面标签">
    <PageTabs
      v-model="activeValue"
      v-model:items="items"
      :ui="pageTabsUi"
      :before-close="beforeClose"
      middle-click-close
    />
  </nav>
</template>
