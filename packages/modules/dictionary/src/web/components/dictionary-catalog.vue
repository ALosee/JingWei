<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Button, ButtonIcon, dialog, Icon, Input, Tree, TreeItem } from '@jingwei/ui'
import type { FlattenedItem, TreeItemData } from '@jingwei/ui'

import type { DictionaryCategory, DictionaryStatus, DictionaryType } from '../../shared/index.js'

const props = defineProps<{
  groups: { category: DictionaryCategory; types: DictionaryType[] }[]
  selectedKind: 'category' | 'type' | null
  selectedCategoryId: string
  selectedTypeId: string
  search: string
  busy: boolean
  canManage: boolean
  categoryCount: number
  typeCount: number
}>()

const emit = defineEmits<{
  updateSearch: [value: string]
  selectCategory: [id: string]
  selectType: [id: string]
  beginCreateCategory: []
  beginCreateType: [categoryId: string]
  deleteCategory: [id: string, expectedRevision: number]
}>()

type DictionaryTreeItemData = TreeItemData<{
  value: string
  kind: 'category' | 'type'
  id: string
  name: string
  code: string
  childCount: number
  status?: DictionaryStatus
}>

const expandedIds = ref<string[]>([])
let knownCategoryValues = new Set<string>()

const treeItems = computed<DictionaryTreeItemData[]>(() =>
  props.groups.map(({ category, types }) => {
    const item: DictionaryTreeItemData = {
      value: categoryValue(category.id),
      kind: 'category',
      id: category.id,
      name: category.name,
      code: category.code,
      childCount: types.length,
    }
    if (types.length > 0) {
      item.children = types.map((type) => ({
        value: typeValue(type.id),
        kind: 'type',
        id: type.id,
        name: type.name,
        code: type.code,
        childCount: 0,
        status: type.status,
      }))
    }
    return item
  }),
)

const categoryValues = computed(() => treeItems.value.map((item) => item.value))

const expanded = computed({
  get: () => (props.search.trim() === '' ? expandedIds.value : categoryValues.value),
  set: (value: string[]) => {
    if (props.search.trim() === '') expandedIds.value = value
  },
})

const selectedValue = computed({
  get: () => {
    if (props.selectedKind === 'category') return categoryValue(props.selectedCategoryId)
    if (props.selectedKind === 'type') return typeValue(props.selectedTypeId)
    return ''
  },
  set: (value: string) => {
    const [kind, id] = value.split(':', 2)
    if (id === undefined || id === '') return
    if (kind === 'category') emit('selectCategory', id)
    else if (kind === 'type') emit('selectType', id)
  },
})

const isEmpty = computed(() => treeItems.value.length === 0)

function categoryValue(id: string) {
  return `category:${id}`
}

function typeValue(id: string) {
  return `type:${id}`
}

function itemOf(flat: FlattenedItem<DictionaryTreeItemData>) {
  return flat.data
}

function rowPadding(level: number) {
  return `${0.35 + Math.max(0, level - 1) * 0.9}rem`
}

function confirmDeleteCategory(categoryId: string) {
  const category = props.groups.find((group) => group.category.id === categoryId)?.category
  if (category === undefined) return
  dialog.warning('删除字典分类', {
    description: `确认删除分类「${category.name}」？只有空分类可以删除。`,
    confirmText: '删除',
    cancelText: '取消',
    onConfirm: () => emit('deleteCategory', category.id, category.revision),
  })
}

function toggleExpanded(value: string, isExpanded: boolean) {
  expanded.value = isExpanded
    ? expanded.value.filter((id) => id !== value)
    : [...expanded.value, value]
}

function expandAll() {
  expandedIds.value = [...categoryValues.value]
}

function collapseAll() {
  expandedIds.value = []
}

function onSearch(value: unknown) {
  emit('updateSearch', typeof value === 'string' ? value : '')
}

watch(
  [categoryValues, () => props.search],
  ([values, search]) => {
    if (search.trim() !== '') return
    const validValues = new Set(values)
    const next = expandedIds.value.filter((value) => validValues.has(value))
    for (const value of values) {
      if (!knownCategoryValues.has(value)) next.push(value)
    }
    expandedIds.value = [...new Set(next)]
    knownCategoryValues = validValues
  },
  { immediate: true },
)

watch(
  () => [props.selectedKind, props.selectedCategoryId] as const,
  ([kind, categoryId]) => {
    if (kind !== 'type' || categoryId === '') return
    const value = categoryValue(categoryId)
    if (!expandedIds.value.includes(value)) expandedIds.value = [...expandedIds.value, value]
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
    <header class="flex items-center gap-2 border-b border-border px-3 py-2.5">
      <div class="min-w-0 flex-1">
        <h2 class="m-0 text-sm font-semibold text-foreground">字典目录</h2>
        <p class="m-0 mt-0.5 text-xs text-muted-foreground">
          {{ categoryCount }} 个分类 · {{ typeCount }} 个类型
        </p>
      </div>
      <div class="flex items-center gap-0.5">
        <ButtonIcon
          icon="lucide:chevrons-down"
          size="sm"
          aria-label="全部展开"
          title="全部展开"
          :disabled="busy || typeCount === 0"
          @click="expandAll"
        />
        <ButtonIcon
          icon="lucide:chevrons-up"
          size="sm"
          aria-label="全部折叠"
          title="全部折叠"
          :disabled="busy || typeCount === 0"
          @click="collapseAll"
        />
        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Button v-if="canManage" size="sm" :disabled="busy" @click="emit('beginCreateCategory')">
          <Icon icon="lucide:folder-plus" class="me-1 size-3.5" />
          新建分类
        </Button>
      </div>
    </header>

    <div class="border-b border-border px-3 py-2">
      <Input
        :model-value="search"
        clearable
        placeholder="搜索分类、类型或编码"
        @update:model-value="onSearch"
        @clear="emit('updateSearch', '')"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-1.5">
      <div v-if="isEmpty" class="grid min-h-20 place-items-center px-4 py-10 text-center">
        <div>
          <Icon
            :icon="search ? 'lucide:search-x' : 'lucide:book-open'"
            class="mx-auto mb-2 size-8 text-muted-foreground/50"
          />
          <p class="m-0 text-sm text-muted-foreground">
            {{ search ? '没有匹配的字典数据' : '暂无字典数据' }}
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
              class="group relative flex items-center gap-1 rounded-md pe-1 transition-colors"
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
                @click.stop="toggleExpanded(item.value, isExpanded)"
              >
                <Icon
                  :icon="isExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="size-3.5"
                />
              </button>
              <span v-else class="size-5 shrink-0" aria-hidden="true" />

              <div class="flex min-w-0 flex-1 items-center gap-2 py-1.5 pe-1">
                <Icon
                  :icon="itemOf(item).kind === 'category' ? 'lucide:folder' : 'lucide:list'"
                  class="size-3.5 shrink-0 opacity-65"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ itemOf(item).name }}</span>
                  <span class="block truncate font-mono text-[0.68rem] text-muted-foreground">
                    {{ itemOf(item).code }}
                    <template v-if="itemOf(item).kind === 'category'">
                      · {{ itemOf(item).childCount }} 个类型
                    </template>
                  </span>
                </span>
                <span
                  v-if="itemOf(item).kind === 'type' && itemOf(item).status === 'DISABLED'"
                  class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  停用
                </span>
              </div>

              <template v-if="canManage && itemOf(item).kind === 'category'">
                <ButtonIcon
                  icon="lucide:plus"
                  size="sm"
                  class="opacity-0 transition-opacity group-hover:opacity-100"
                  :class="isSelected ? 'opacity-100' : ''"
                  aria-label="在分类下新建类型"
                  :disabled="busy"
                  @click.stop="emit('beginCreateType', itemOf(item).id)"
                />
                <ButtonIcon
                  icon="lucide:trash-2"
                  size="sm"
                  class="opacity-0 transition-opacity group-hover:opacity-100"
                  :class="isSelected ? 'opacity-100' : ''"
                  aria-label="删除分类"
                  :disabled="busy || itemOf(item).childCount > 0"
                  @click.stop="confirmDeleteCategory(itemOf(item).id)"
                />
              </template>
            </div>
          </TreeItem>
        </template>
      </Tree>
    </div>
  </section>
</template>
