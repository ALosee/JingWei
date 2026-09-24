<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { Button, ButtonLoading, Icon, Input, InputNumber, Separator } from '@jingwei/ui'

import type {
  DictionaryCategory,
  DictionaryType,
  UpdateDictionaryCategory,
} from '../../shared/index.js'

const props = defineProps<{
  category: DictionaryCategory
  types: DictionaryType[]
  busy: boolean
  canManage: boolean
}>()

const emit = defineEmits<{
  beginCreateType: [categoryId: string]
  selectType: [id: string]
  updateCategory: [id: string, input: UpdateDictionaryCategory]
  dirtyChange: [dirty: boolean]
}>()

const draft = reactive({ name: '', sortOrder: 0 })

const sortedTypes = computed(() =>
  props.types.toSorted(
    (left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code),
  ),
)
const canSave = computed(() => {
  if (draft.name.trim() === '') return false
  return draft.name.trim() !== props.category.name || draft.sortOrder !== props.category.sortOrder
})
const dirty = computed(
  () => draft.name !== props.category.name || draft.sortOrder !== props.category.sortOrder,
)

function save() {
  if (!canSave.value) return
  emit('updateCategory', props.category.id, {
    name: draft.name.trim(),
    sortOrder: draft.sortOrder,
    expectedRevision: props.category.revision,
  })
}

function onName(value: unknown) {
  draft.name = typeof value === 'string' ? value : ''
}

function onSortOrder(value: unknown) {
  draft.sortOrder = typeof value === 'number' ? value : Number(value ?? 0)
}

watch(
  () => props.category,
  (category) => {
    draft.name = category.name
    draft.sortOrder = category.sortOrder
  },
  { immediate: true },
)
watch(dirty, (value) => emit('dirtyChange', value), { immediate: true })
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <header class="flex min-h-16 flex-wrap items-center gap-3 border-b border-border px-5 py-2">
      <div class="min-w-0 flex-1">
        <h2 class="m-0 truncate text-base font-semibold text-foreground">{{ category.name }}</h2>
        <p class="m-0 mt-1 truncate font-mono text-xs text-muted-foreground">
          {{ category.code }} · {{ types.length }} 个类型
        </p>
      </div>
      <template v-if="canManage">
        <Button variant="soft" :disabled="busy" @click="emit('beginCreateType', category.id)">
          <Icon icon="lucide:plus" class="me-1 size-3.5" />
          新建类型
        </Button>
        <ButtonLoading :loading="busy" :disabled="!canSave" @click="save"> 保存资料 </ButtonLoading>
      </template>
    </header>

    <div class="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
      <div class="grid items-start gap-4 md:grid-cols-2">
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">分类编码</span>
          <code class="py-1.5 text-sm text-foreground select-text">{{ category.code }}</code>
          <span class="min-h-[1.25rem] text-xs text-muted-foreground">创建后不可修改</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">分类名称</span>
          <Input :model-value="draft.name" :disabled="!canManage" @update:model-value="onName" />
          <span class="min-h-[1.25rem]" aria-hidden="true"></span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">排序</span>
          <InputNumber
            :model-value="draft.sortOrder"
            :min="-100000"
            :max="100000"
            :disabled="!canManage"
            @update:model-value="onSortOrder"
          />
          <span class="min-h-[1.25rem] text-xs text-muted-foreground">数值越小越靠前</span>
        </label>
      </div>

      <Separator />

      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="min-w-0 flex-1">
            <h3 class="m-0 text-sm font-medium text-foreground">字典类型</h3>
            <p class="m-0 mt-1 text-xs text-muted-foreground">
              选择类型后可继续维护其状态和字典条目。
            </p>
          </div>
        </div>

        <div
          v-if="sortedTypes.length === 0"
          class="grid min-h-36 place-items-center border-y border-border px-4 text-center"
        >
          <div>
            <Icon icon="lucide:list-plus" class="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p class="m-0 text-sm text-muted-foreground">该分类下暂无字典类型</p>
          </div>
        </div>

        <ul v-else class="m-0 list-none divide-y divide-border border-y border-border p-0">
          <li v-for="type in sortedTypes" :key="type.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 bg-transparent px-3 py-2.5 text-start text-foreground transition-colors hover:bg-muted/50 cursor-pointer"
              @click="emit('selectType', type.id)"
            >
              <Icon icon="lucide:list" class="size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ type.name }}</span>
                <span class="block truncate font-mono text-xs text-muted-foreground">
                  {{ type.code }}
                </span>
              </span>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                :class="
                  type.status === 'ENABLED'
                    ? 'bg-success/12 text-success'
                    : 'bg-muted text-muted-foreground'
                "
              >
                {{ type.status === 'ENABLED' ? '启用' : '停用' }}
              </span>
              <Icon icon="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
