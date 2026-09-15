<script setup lang="ts">
import { computed } from 'vue'

import { Button, ButtonIcon, Icon, Input, Tree, TreeItem } from '@jingwei/ui'
import type { FlattenedItem } from '@jingwei/ui'

import {
  organizationTypeLabel,
  organizationUnitIcon,
  type OrganizationTreeNode,
} from '../../shared/index.js'
import {
  collectTreeItemIds,
  filterOrganizationTreeItems,
  type OrganizationTreeItemData,
} from '../composables/organization-tree.js'

const props = defineProps<{
  tree: OrganizationTreeNode[]
  selectedId: string
  search: string
  expandedIds: string[]
  busy: boolean
  canManage: boolean
  unitCount: number
}>()

const emit = defineEmits<{
  updateSearch: [value: string]
  updateExpandedIds: [value: string[]]
  select: [id: string]
  expandAll: []
  collapseAll: []
  addChild: [parentId: string]
  addRoot: []
}>()

const treeItems = computed(() => {
  const mapNode = (node: OrganizationTreeNode): OrganizationTreeItemData => {
    const item: OrganizationTreeItemData = {
      value: node.unit.id,
      name: node.unit.name,
      code: node.unit.code,
      type: node.unit.type,
      status: node.unit.status,
    }
    if (node.children.length > 0) item.children = node.children.map(mapNode)
    return item
  }
  const full = props.tree.map(mapNode)
  if (props.search.trim() === '') return full
  return filterOrganizationTreeItems(props.tree, props.search)
})

/** While searching, force-expand every visible branch. */
const expanded = computed({
  get: () => (props.search.trim() === '' ? props.expandedIds : collectTreeItemIds(treeItems.value)),
  set: (value: string[]) => {
    if (props.search.trim() !== '') return
    emit('updateExpandedIds', value)
  },
})

const selectedValue = computed({
  get: () => props.selectedId,
  set: (value: string) => {
    if (value !== '') emit('select', value)
  },
})

const isEmpty = computed(() => treeItems.value.length === 0)

function onSearchUpdate(value: unknown): void {
  emit('updateSearch', typeof value === 'string' ? value : '')
}

function rowPadding(level: number): string {
  return `${0.35 + Math.max(0, level - 1) * 0.9}rem`
}

function itemOf(flat: FlattenedItem<OrganizationTreeItemData>) {
  return flat.data
}
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
    <header class="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
      <div class="min-w-0 flex-1">
        <h2 class="m-0 text-sm font-semibold text-foreground">组织树</h2>
        <p class="m-0 mt-0.5 text-xs text-muted-foreground">{{ unitCount }} 个组织单元</p>
      </div>
      <div class="flex items-center gap-0.5">
        <ButtonIcon
          icon="lucide:chevrons-down"
          size="sm"
          aria-label="全部展开"
          title="全部展开"
          :disabled="busy"
          @click="emit('expandAll')"
        />
        <ButtonIcon
          icon="lucide:chevrons-up"
          size="sm"
          aria-label="全部折叠"
          title="全部折叠"
          :disabled="busy"
          @click="emit('collapseAll')"
        />
        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Button v-if="canManage" size="sm" :disabled="busy" @click="emit('addRoot')">
          <Icon icon="lucide:plus" class="me-1 size-3.5" />
          新建
        </Button>
      </div>
    </header>

    <div class="border-b border-border px-3 py-2">
      <Input
        :model-value="search"
        clearable
        placeholder="搜索名称 / 编码"
        class="w-full"
        @update:model-value="onSearchUpdate"
        @clear="emit('updateSearch', '')"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-1.5">
      <div v-if="isEmpty" class="grid min-h-16 place-items-center px-4 py-10 text-center">
        <div>
          <Icon
            :icon="search ? 'lucide:search-x' : 'lucide:network'"
            class="mx-auto mb-2 size-8 text-muted-foreground/50"
          />
          <p class="m-0 text-sm text-muted-foreground">
            {{ search ? '没有匹配的组织' : '暂无组织单元' }}
          </p>
          <p v-if="!search && canManage" class="m-0 mt-1 text-xs text-muted-foreground/80">
            点击右上角「新建」创建根组织
          </p>
        </div>
      </div>

      <Tree
        v-else
        v-model="selectedValue"
        v-model:expanded="expanded"
        :items="treeItems"
        allow-parent-select
        selection-behavior="replace"
        class="m-0 list-none p-0"
      >
        <template #item="{ item }">
          <TreeItem
            v-slot="{ isSelected, isExpanded, hasChildren }"
            :value="item.value"
            :level="item.level"
            :disabled-toggle="true"
          >
            <div
              class="group relative flex items-center gap-1 rounded-md pe-1"
              :class="
                isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent/50'
              "
              :style="{ paddingLeft: rowPadding(item.level) }"
            >
              <button
                v-if="hasChildren"
                type="button"
                class="grid size-5 shrink-0 place-items-center border-none bg-transparent text-muted-foreground cursor-pointer"
                :aria-label="isExpanded ? '折叠' : '展开'"
                @click.stop="
                  emit(
                    'updateExpandedIds',
                    isExpanded
                      ? expanded.filter((id) => id !== item.value)
                      : [...expanded, item.value],
                  )
                "
              >
                <Icon
                  :icon="isExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="size-3.5"
                />
              </button>
              <span v-else class="size-5 shrink-0" aria-hidden="true" />

              <div class="flex min-w-0 flex-1 items-center gap-2 py-1.5 pe-1">
                <Icon
                  :icon="organizationUnitIcon(itemOf(item).type)"
                  class="size-3.5 shrink-0 opacity-65"
                />
                <span class="min-w-0 flex-1 truncate text-sm">
                  {{ itemOf(item).name }}
                </span>
                <span
                  v-if="itemOf(item).status === 'DISABLED'"
                  class="shrink-0 rounded-full bg-muted px-1.5 py-px text-[0.65rem] text-muted-foreground"
                >
                  停用
                </span>
                <span
                  v-else
                  class="shrink-0 truncate text-[0.65rem] text-muted-foreground max-w-5rem"
                >
                  {{ organizationTypeLabel(itemOf(item).type) }}
                </span>
              </div>

              <ButtonIcon
                v-if="canManage"
                icon="lucide:plus"
                size="sm"
                class="opacity-0 transition-opacity group-hover:opacity-100"
                :class="isSelected ? 'opacity-100' : ''"
                aria-label="新建下级组织"
                :disabled="busy"
                @click.stop="emit('addChild', item.value)"
              />
            </div>
          </TreeItem>
        </template>
      </Tree>
    </div>
  </section>
</template>
