<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { Button, ButtonLoading, Icon, Input, InputNumber, Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type {
  DictionaryItem,
  DictionaryStatus,
  DictionaryTypeDetail,
  UpdateDictionaryItem,
} from '../../shared/index.js'

const props = defineProps<{
  detail: DictionaryTypeDetail
  item: DictionaryItem
  busy: boolean
}>()

const emit = defineEmits<{
  cancel: []
  updateItem: [id: string, input: UpdateDictionaryItem]
}>()

const statusItems: SelectSingleOptionData<string>[] = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' },
]

const draft = reactive<{ label: string; status: DictionaryStatus; sortOrder: number }>({
  label: '',
  status: 'ENABLED',
  sortOrder: 0,
})

const canSave = computed(() => {
  if (draft.label.trim() === '') return false
  return (
    draft.label.trim() !== props.item.label ||
    draft.status !== props.item.status ||
    draft.sortOrder !== props.item.sortOrder
  )
})

function save() {
  if (!canSave.value) return
  emit('updateItem', props.item.id, {
    label: draft.label.trim(),
    status: draft.status,
    sortOrder: draft.sortOrder,
    expectedRevision: props.detail.type.revision,
  })
}

function onLabel(value: unknown) {
  draft.label = typeof value === 'string' ? value : ''
}

function onStatus(value: unknown) {
  if (value === 'ENABLED' || value === 'DISABLED') draft.status = value
}

function onSortOrder(value: unknown) {
  draft.sortOrder = typeof value === 'number' ? value : Number(value ?? 0)
}

watch(
  () => props.item,
  (item) => {
    draft.label = item.label
    draft.status = item.status
    draft.sortOrder = item.sortOrder
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
    <header class="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <div class="min-w-0 flex-1">
        <h2 class="m-0 truncate text-base font-semibold text-foreground">编辑字典条目</h2>
        <p class="m-0 mt-1 truncate text-xs text-muted-foreground">
          所属类型：{{ detail.type.name }} · {{ detail.type.code }}
        </p>
      </div>
      <Button variant="ghost" size="sm" :disabled="busy" @click="emit('cancel')">取消</Button>
      <ButtonLoading size="sm" :loading="busy" :disabled="!canSave" @click="save">
        保存
      </ButtonLoading>
    </header>

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <div class="grid items-start gap-4 md:grid-cols-2">
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">稳定编码</span>
          <Input :model-value="item.code" disabled />
          <span class="text-xs text-muted-foreground">业务数据保存该编码，创建后不可修改</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">展示文字</span>
          <Input :model-value="draft.label" autofocus @update:model-value="onLabel" />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">状态</span>
          <Select :model-value="draft.status" :items="statusItems" @update:model-value="onStatus" />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">排序</span>
          <InputNumber
            :model-value="draft.sortOrder"
            :min="-100000"
            :max="100000"
            @update:model-value="onSortOrder"
          />
          <span class="text-xs text-muted-foreground">数值越小越靠前</span>
        </label>
      </div>

      <div
        class="mt-6 flex items-start gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground"
      >
        <Icon icon="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
        <span>停用后不再用于新选择，但仍会保留编码和当前文字以解析历史数据。</span>
      </div>
    </div>
  </section>
</template>
