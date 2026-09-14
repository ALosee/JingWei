<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { PageTabs, type PageTabsOptionData } from '@jingwei/ui'

interface WorkspaceTab {
  /** Stable page identity (path only). Query/hash changes must not open a new tab. */
  path: string
  /** Last concrete location for this page, including query/hash. */
  fullPath: string
  label: string
}

const route = useRoute()
const router = useRouter()
const tabs = ref<WorkspaceTab[]>([])
const activeValue = ref('')
const pageTabsUi = {
  root: 'h-full min-w-max items-end px-2',
  item: 'h-8',
} as const

const items = computed<PageTabsOptionData[]>(() =>
  tabs.value.map((tab) => ({
    value: tab.path,
    label: tab.label,
    hidePinnedIcon: true,
    draggable: false,
  })),
)

function resolveLabel(): string {
  if (typeof route.meta.title === 'string' && route.meta.title !== '') return route.meta.title
  if (typeof route.name === 'string' && route.name !== '') return route.name
  return route.path
}

watch(
  () => route.fullPath,
  () => {
    const path = route.path
    const label = resolveLabel()
    const index = tabs.value.findIndex((tab) => tab.path === path)
    if (index >= 0) {
      tabs.value[index] = { path, fullPath: route.fullPath, label }
    } else {
      tabs.value.push({ path, fullPath: route.fullPath, label })
    }
    activeValue.value = path
  },
  { immediate: true },
)

watch(activeValue, async (path) => {
  if (path === '' || path === route.path) return
  const tab = tabs.value.find((item) => item.path === path)
  const target = tab?.fullPath ?? path
  if (target !== route.fullPath) await router.push(target)
})

function onItemsChange(next: PageTabsOptionData[]): void {
  const openPaths = new Set(next.map((item) => item.value))
  tabs.value = tabs.value.filter((tab) => openPaths.has(tab.path))
}

function beforeClose(): boolean {
  return tabs.value.length > 1
}
</script>

<template>
  <nav class="h-full w-full overflow-x-auto border-b border-border bg-card" aria-label="页面标签">
    <PageTabs
      v-model="activeValue"
      :items="items"
      :ui="pageTabsUi"
      :before-close="beforeClose"
      middle-click-close
      @update:items="onItemsChange"
    />
  </nav>
</template>
