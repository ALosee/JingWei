<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { Button, ButtonLoading, Icon, Input, InputNumber, Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type {
  CreateDictionaryCategory,
  CreateDictionaryItem,
  CreateDictionaryType,
  DictionaryCategory,
  DictionaryStatus,
  DictionaryTypeDetail,
} from '../../shared/index.js'

const props = defineProps<{
  mode: 'category' | 'type' | 'item'
  categoryId: string
  categories: DictionaryCategory[]
  detail: DictionaryTypeDetail | null
  busy: boolean
}>()

const emit = defineEmits<{
  cancel: []
  createCategory: [input: CreateDictionaryCategory]
  createType: [input: CreateDictionaryType]
  createItem: [input: CreateDictionaryItem]
  dirtyChange: [dirty: boolean]
}>()

const statusItems: SelectSingleOptionData<string>[] = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' },
]

const categoryItems = computed<SelectSingleOptionData<string>[]>(() =>
  props.categories
    .toSorted(
      (left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
    )
    .map((category) => ({ value: category.id, label: `${category.name} · ${category.code}` })),
)

const categoryDraft = reactive({ code: '', name: '', sortOrder: 0 })
const typeDraft = reactive<{
  categoryId: string
  code: string
  name: string
  status: DictionaryStatus
}>({
  categoryId: props.categoryId,
  code: '',
  name: '',
  status: 'ENABLED',
})
const itemDraft = reactive<{
  code: string
  label: string
  status: DictionaryStatus
  sortOrder: number
}>({
  code: '',
  label: '',
  status: 'ENABLED',
  sortOrder:
    props.detail?.items.length === 0
      ? 0
      : Math.max(...(props.detail?.items.map((item) => item.sortOrder) ?? [0])) + 1,
})
const initialItemSortOrder = itemDraft.sortOrder
const dirty = computed(() => {
  if (props.mode === 'category')
    return categoryDraft.code !== '' || categoryDraft.name !== '' || categoryDraft.sortOrder !== 0
  if (props.mode === 'type')
    return (
      typeDraft.categoryId !== props.categoryId ||
      typeDraft.code !== '' ||
      typeDraft.name !== '' ||
      typeDraft.status !== 'ENABLED'
    )
  return (
    itemDraft.code !== '' ||
    itemDraft.label !== '' ||
    itemDraft.status !== 'ENABLED' ||
    itemDraft.sortOrder !== initialItemSortOrder
  )
})
watch(dirty, (value) => emit('dirtyChange', value), { immediate: true })

const title = computed(() => {
  if (props.mode === 'category') return '新建分类'
  if (props.mode === 'type') return '新建字典类型'
  return '新建字典条目'
})

const description = computed(() => {
  if (props.mode === 'category') return '分类仅用于整理和展示字典类型。'
  if (props.mode === 'type') return '类型编码是跨模块引用的稳定身份，创建后不可修改。'
  return props.detail === null
    ? '请先选择一个字典类型。'
    : `所属类型：${props.detail.type.name} · ${props.detail.type.code}`
})

const canSubmit = computed(() => {
  if (props.mode === 'category')
    return categoryDraft.code.trim() !== '' && categoryDraft.name.trim() !== ''
  if (props.mode === 'type')
    return (
      typeDraft.categoryId !== '' && typeDraft.code.trim() !== '' && typeDraft.name.trim() !== ''
    )
  return props.detail !== null && itemDraft.code.trim() !== '' && itemDraft.label.trim() !== ''
})

function submit() {
  if (!canSubmit.value) return
  if (props.mode === 'category') {
    emit('createCategory', {
      code: categoryDraft.code.trim(),
      name: categoryDraft.name.trim(),
      sortOrder: categoryDraft.sortOrder,
    })
    return
  }
  if (props.mode === 'type') {
    emit('createType', {
      categoryId: typeDraft.categoryId,
      code: typeDraft.code.trim(),
      name: typeDraft.name.trim(),
      status: typeDraft.status,
    })
    return
  }
  const detail = props.detail
  if (detail === null) return
  emit('createItem', {
    code: itemDraft.code.trim(),
    label: itemDraft.label.trim(),
    status: itemDraft.status,
    sortOrder: itemDraft.sortOrder,
    expectedRevision: detail.type.revision,
  })
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function number(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function onStatus(value: unknown) {
  return value === 'ENABLED' || value === 'DISABLED' ? value : 'ENABLED'
}
</script>

<template>
  <form class="flex min-h-0 flex-1 flex-col overflow-hidden" @submit.prevent="submit">
    <header class="flex min-h-16 flex-wrap items-center gap-3 border-b border-border px-5 py-2">
      <div class="min-w-0 flex-1">
        <h2 class="m-0 truncate text-base font-semibold text-foreground">{{ title }}</h2>
        <p class="m-0 mt-1 truncate text-xs text-muted-foreground">{{ description }}</p>
      </div>
      <Button type="button" variant="ghost" :disabled="busy" @click="emit('cancel')"> 取消 </Button>
      <ButtonLoading type="submit" :loading="busy" :disabled="!canSubmit"> 创建 </ButtonLoading>
    </header>

    <div class="min-h-0 flex-1 overflow-auto px-5 py-4">
      <div v-if="mode === 'category'" class="grid items-start gap-4 md:grid-cols-2">
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">分类编码</span>
          <Input
            :model-value="categoryDraft.code"
            placeholder="如 common"
            autofocus
            @update:model-value="(value: unknown) => (categoryDraft.code = text(value))"
          />
          <span class="text-xs text-muted-foreground">租户内唯一，创建后不可修改</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">分类名称</span>
          <Input
            :model-value="categoryDraft.name"
            placeholder="如 通用数据"
            @update:model-value="(value: unknown) => (categoryDraft.name = text(value))"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">排序</span>
          <InputNumber
            :model-value="categoryDraft.sortOrder"
            :min="-100000"
            :max="100000"
            @update:model-value="(value: unknown) => (categoryDraft.sortOrder = number(value))"
          />
          <span class="text-xs text-muted-foreground">数值越小越靠前</span>
        </label>
      </div>

      <div v-else-if="mode === 'type'" class="grid items-start gap-4 md:grid-cols-2">
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">所属分类</span>
          <Select
            :model-value="typeDraft.categoryId"
            :items="categoryItems"
            @update:model-value="(value: unknown) => (typeDraft.categoryId = text(value))"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">稳定编码</span>
          <Input
            :model-value="typeDraft.code"
            placeholder="如 common.gender"
            autofocus
            @update:model-value="(value: unknown) => (typeDraft.code = text(value))"
          />
          <span class="text-xs text-muted-foreground">业务模块通过该编码查询字典</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">类型名称</span>
          <Input
            :model-value="typeDraft.name"
            placeholder="如 性别"
            @update:model-value="(value: unknown) => (typeDraft.name = text(value))"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">状态</span>
          <Select
            :model-value="typeDraft.status"
            :items="statusItems"
            @update:model-value="(value: unknown) => (typeDraft.status = onStatus(value))"
          />
        </label>
      </div>

      <div v-else class="grid items-start gap-4 md:grid-cols-2">
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">稳定编码</span>
          <Input
            :model-value="itemDraft.code"
            placeholder="如 female"
            autofocus
            @update:model-value="(value: unknown) => (itemDraft.code = text(value))"
          />
          <span class="text-xs text-muted-foreground">业务数据保存该编码，创建后不可修改</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">展示文字</span>
          <Input
            :model-value="itemDraft.label"
            placeholder="如 女"
            @update:model-value="(value: unknown) => (itemDraft.label = text(value))"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">状态</span>
          <Select
            :model-value="itemDraft.status"
            :items="statusItems"
            @update:model-value="(value: unknown) => (itemDraft.status = onStatus(value))"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">排序</span>
          <InputNumber
            :model-value="itemDraft.sortOrder"
            :min="-100000"
            :max="100000"
            @update:model-value="(value: unknown) => (itemDraft.sortOrder = number(value))"
          />
          <span class="text-xs text-muted-foreground">数值越小越靠前</span>
        </label>
      </div>

      <div
        class="mt-6 flex items-start gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground"
      >
        <Icon icon="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
        <span v-if="mode === 'category'">分类不影响字典的业务可用性，仅用于管理端展示。</span>
        <span v-else-if="mode === 'type'"
          >类型创建后可以调整名称、状态和所属分类，但稳定编码不可修改。</span
        >
        <span v-else>条目停用后仍会保留编码和文字，用于解析历史数据。</span>
      </div>
    </div>
  </form>
</template>
