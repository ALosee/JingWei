<script setup lang="ts">
import { Icon } from '@jingwei/ui'

import { isContainer, resolveNavigationIcon, type NavigationNode } from '../../shared/index.js'

const props = defineProps<{
  node: NavigationNode
  children: NavigationNode[]
  childMap: ReadonlyMap<string | null, NavigationNode[]>
  depth: number
}>()

const emit = defineEmits<{
  reveal: [nodeId: string]
}>()

function typeIcon(node: NavigationNode): string {
  return resolveNavigationIcon(node.icon, node.type)
}

function descendantsOf(id: string): NavigationNode[] {
  return props.childMap.get(id) ?? []
}
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-md border-none bg-transparent py-1.5 pe-1 text-left text-sm cursor-pointer hover:bg-accent"
      :class="depth === 0 ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
      :style="{ paddingLeft: `${0.35 + depth * 0.75}rem` }"
      @click="emit('reveal', node.id)"
    >
      <Icon
        :icon="typeIcon(node)"
        class="size-3.5 shrink-0"
        :class="depth === 0 ? 'opacity-70' : 'opacity-60'"
      />
      <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>
      <span v-if="isContainer(node)" class="text-[0.7rem] text-muted-foreground">
        {{ children.length }}
      </span>
    </button>
    <ul v-if="children.length > 0" class="m-0 list-none p-0">
      <NavigationPreviewTreeItem
        v-for="child in children"
        :key="child.id"
        :node="child"
        :children="descendantsOf(child.id)"
        :child-map="childMap"
        :depth="depth + 1"
        @reveal="(id) => emit('reveal', id)"
      />
    </ul>
  </li>
</template>
