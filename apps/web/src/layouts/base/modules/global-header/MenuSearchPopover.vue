<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { ButtonIcon, Icon, Popover } from '@jingwei/ui'

import {
  resolveNavigationIcon,
  searchableNavigationItems,
} from '../../../../navigation/presentation.js'
import { useShellStore } from '../../../../stores/shell.js'

const shell = useShellStore()
const open = ref(false)
const query = ref('')
const input = ref<HTMLInputElement | null>(null)
const items = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  const all = searchableNavigationItems(shell.navigation?.nodes ?? [])
  if (keyword === '') return all.slice(0, 8)
  return all.filter((item) => item.label.toLocaleLowerCase('zh-CN').includes(keyword)).slice(0, 8)
})

watch(open, async (value) => {
  if (!value) {
    query.value = ''
    return
  }
  await nextTick()
  input.value?.focus()
})

function close(): void {
  open.value = false
}
</script>

<template>
  <Popover
    v-model:open="open"
    :modal="false"
    :show-arrow="false"
    placement="bottom-end"
    class="w-[min(24rem,calc(100vw-1rem))] p-2"
    :popup-props="{ 'aria-label': '菜单搜索' }"
  >
    <template #trigger>
      <ButtonIcon icon="lucide:search" variant="ghost" aria-label="菜单搜索" />
    </template>

    <label>
      <span class="sr-only">搜索菜单</span>
      <input
        ref="input"
        v-model="query"
        type="search"
        class="min-h-10 w-full border border-input rounded-md bg-background px-3 text-foreground outline-none focus:ring-3 focus:ring-primary/30"
        placeholder="搜索菜单…"
      />
    </label>
    <ul v-if="items.length > 0" class="mt-2 max-h-80 grid gap-0.5 overflow-y-auto p-0 list-none">
      <li v-for="item in items" :key="item.node.id">
        <RouterLink
          v-if="item.node.type === 'MENU'"
          :to="item.target"
          class="flex items-center gap-2 rounded-md p-2 text-foreground decoration-none hover:bg-accent"
          @click="close"
        >
          <Icon :icon="resolveNavigationIcon(item.node.icon, item.node.type)" />
          <span>{{ item.label }}</span>
        </RouterLink>
        <a
          v-else
          :href="item.target"
          :target="item.node.externalTarget === 'BLANK' ? '_blank' : '_self'"
          rel="noopener noreferrer"
          class="flex items-center gap-2 rounded-md p-2 text-foreground decoration-none hover:bg-accent"
          @click="close"
        >
          <Icon :icon="resolveNavigationIcon(item.node.icon, item.node.type)" />
          <span>{{ item.label }}</span>
        </a>
      </li>
    </ul>
    <p v-else class="m-2 text-xs text-muted-foreground">没有匹配的菜单</p>
  </Popover>
</template>
