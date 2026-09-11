<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { PageTabs, type PageTabsOptionData } from '@jingwei/ui'

const route = useRoute()
const router = useRouter()
const activeValue = ref(route.fullPath)
const items = ref<PageTabsOptionData[]>([])
const pageTabsUi = {
  root: 'h-full min-w-max items-end px-2',
  item: 'h-8',
} as const

watch(
  () => route.fullPath,
  (fullPath) => {
    activeValue.value = fullPath
    const title =
      typeof route.meta.title === 'string'
        ? route.meta.title
        : typeof route.name === 'string'
          ? route.name
          : fullPath
    const existing = items.value.findIndex((item) => item.value === fullPath)
    const item = { value: fullPath, label: title, hidePinnedIcon: true, draggable: false }
    if (existing >= 0) {
      items.value[existing] = item
      return
    }
    items.value.push(item)
  },
  { immediate: true },
)

watch(activeValue, async (value) => {
  if (value !== '' && value !== route.fullPath) await router.push(value)
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
