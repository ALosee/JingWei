<script setup lang="ts">
import { Button, ButtonIcon, DropdownMenu, Icon, Input } from '@jingwei/ui'
import type { MenuOptionData } from '@jingwei/ui'

import {
  resolveNavigationIcon,
  type NavigationNode,
  type NavigationNodeType,
} from '../../shared/index.js'
import type { NavigationTreeRow } from '../composables/navigation-tree.js'

defineProps<{
  rows: NavigationTreeRow[]
  selectedId: string
  highlightId: string
  search: string
  readOnly: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  updateSearch: [value: string]
  select: [id: string]
  toggle: [id: string]
  expandAll: []
  collapseAll: []
  addChild: [type: NavigationNodeType]
  addSibling: []
  remove: []
  move: [delta: -1 | 1]
}>()

type TreeAction =
  | 'add-menu'
  | 'add-page'
  | 'add-directory'
  | 'add-group'
  | 'add-link'
  | 'add-sibling'
  | 'remove'

const typeLabel: Record<NavigationNodeType, string> = {
  DIRECTORY: '目录',
  GROUP: '分组',
  MENU: '菜单',
  PAGE: '页面',
  EXTERNAL_LINK: '外链',
}

function nodeIcon(node: NavigationNode): string {
  return resolveNavigationIcon(node.icon, node.type)
}

const accessLabel: Record<string, string> = {
  PUBLIC: '公开',
  AUTHENTICATED: '登录',
  PERMISSION: '权限',
}

const menuItems: MenuOptionData<TreeAction>[] = [
  { value: 'add-menu', label: '新建菜单', icon: 'lucide:layout-grid' },
  { value: 'add-page', label: '新建页面', icon: 'lucide:file-text' },
  { value: 'add-directory', label: '新建目录', icon: 'lucide:folder' },
  { value: 'add-group', label: '新建分组', icon: 'lucide:layers' },
  { value: 'add-link', label: '新建外链', icon: 'lucide:external-link' },
  { value: 'add-sibling', label: '新建同级', icon: 'lucide:corner-down-right' },
  { value: 'remove', label: '删除节点', icon: 'lucide:trash-2' },
]

function onMenuSelect(item: MenuOptionData<TreeAction>): void {
  switch (item.value) {
    case 'add-menu':
      emit('addChild', 'MENU')
      break
    case 'add-page':
      emit('addChild', 'PAGE')
      break
    case 'add-directory':
      emit('addChild', 'DIRECTORY')
      break
    case 'add-group':
      emit('addChild', 'GROUP')
      break
    case 'add-link':
      emit('addChild', 'EXTERNAL_LINK')
      break
    case 'add-sibling':
      emit('addSibling')
      break
    case 'remove':
      emit('remove')
      break
  }
}

function onSearchUpdate(value: unknown): void {
  emit('updateSearch', typeof value === 'string' ? value : '')
}

function rowLabel(row: NavigationTreeRow): string {
  return `${typeLabel[row.node.type]} ${row.node.name}`
}
</script>

<template>
  <section class="flex min-h-0 flex-col gap-3">
    <header class="flex flex-wrap items-center gap-2">
      <h2 class="m-0 flex-1 text-sm font-semibold text-foreground">结构树</h2>
      <Button
        v-if="!readOnly"
        size="sm"
        variant="outline"
        :disabled="busy"
        @click="emit('addChild', 'MENU')"
      >
        <Icon icon="lucide:plus" class="me-1 size-3.5" />
        新增
      </Button>
      <DropdownMenu
        :items="menuItems"
        placement="bottom-end"
        :modal="false"
        :disabled="readOnly || busy"
        class="min-w-36"
        @select="onMenuSelect"
      >
        <template #trigger>
          <ButtonIcon
            icon="lucide:more-horizontal"
            size="sm"
            variant="ghost"
            aria-label="节点操作"
            :disabled="readOnly || busy"
          />
        </template>
      </DropdownMenu>
    </header>

    <div class="flex gap-2">
      <Input
        :model-value="search"
        placeholder="搜索名称 / code / routeKey"
        class="min-w-0 flex-1"
        @update:model-value="onSearchUpdate"
      />
      <Button
        v-if="search"
        size="sm"
        variant="ghost"
        class="shrink-0"
        aria-label="清除搜索"
        @click="emit('updateSearch', '')"
      >
        清除
      </Button>
    </div>

    <div class="flex items-center gap-1">
      <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="emit('expandAll')">
        全部展开
      </Button>
      <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="emit('collapseAll')">
        全部折叠
      </Button>
      <div class="ms-auto flex items-center gap-0.5">
        <ButtonIcon
          icon="lucide:arrow-up"
          size="sm"
          variant="ghost"
          aria-label="上移"
          :disabled="readOnly || busy || !selectedId"
          @click="emit('move', -1)"
        />
        <ButtonIcon
          icon="lucide:arrow-down"
          size="sm"
          variant="ghost"
          aria-label="下移"
          :disabled="readOnly || busy || !selectedId"
          @click="emit('move', 1)"
        />
      </div>
    </div>

    <div class="min-h-12rem max-h-[min(28rem,50vh)] overflow-auto rounded-md border border-border">
      <p v-if="rows.length === 0" class="m-0 px-3 py-6 text-center text-sm text-muted-foreground">
        {{ search ? '没有匹配的节点' : '暂无节点，点击「新增」创建。' }}
      </p>
      <ul v-else class="m-0 list-none p-1">
        <li v-for="row in rows" :key="row.node.id">
          <div
            class="group flex items-center gap-1 rounded-md pe-1"
            :class="
              row.node.id === selectedId
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-accent/60 text-foreground'
            "
            :style="{ paddingLeft: `${0.35 + row.depth * 0.85}rem` }"
          >
            <button
              v-if="row.hasChildren"
              type="button"
              class="grid size-6 shrink-0 place-items-center border-none bg-transparent text-muted-foreground cursor-pointer"
              :aria-label="row.expanded ? '折叠' : '展开'"
              @click="emit('toggle', row.node.id)"
            >
              <Icon
                :icon="row.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                class="size-3.5"
              />
            </button>
            <span v-else class="size-6 shrink-0" aria-hidden="true" />

            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 border-none bg-transparent py-1.5 pe-1 text-left cursor-pointer"
              :aria-label="rowLabel(row)"
              @click="emit('select', row.node.id)"
            >
              <Icon :icon="nodeIcon(row.node)" class="size-3.5 shrink-0 opacity-70" />
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm"
                  :class="row.node.status === 'DISABLED' ? 'opacity-50 line-through' : ''"
                >
                  {{ row.node.name }}
                </span>
                <span class="block truncate text-[0.7rem] text-muted-foreground">
                  {{ typeLabel[row.node.type] }} · {{ row.node.code
                  }}<template v-if="row.node.accessMode">
                    · {{ accessLabel[row.node.accessMode] ?? row.node.accessMode }}</template
                  >
                  <template v-if="row.node.type === 'PAGE'"> · 隐藏</template>
                </span>
              </span>
              <span
                v-if="row.node.id === highlightId"
                class="size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
