<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { Button, ButtonIcon, ButtonLoading, Icon, Input, Select, Separator } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type {
  DictionaryCategory,
  DictionaryItem,
  DictionaryStatus,
  DictionaryType,
  DictionaryTypeDetail,
  UpdateDictionaryItem,
  UpdateDictionaryType,
} from '../../shared/index.js'

const props = defineProps<{
  detail: DictionaryTypeDetail | null
  selectedTypeId?: string | undefined
  selectedType?: DictionaryType | undefined
  categories: DictionaryCategory[]
  busy: boolean
  loading?: boolean | undefined
  canManage: boolean
}>()

const showingCurrentType = computed(
  () =>
    props.detail !== null &&
    props.selectedTypeId !== undefined &&
    props.selectedTypeId !== '' &&
    props.detail.type.id === props.selectedTypeId,
)

/** Prefer full detail; fall back to catalog summary so the first switch still shows the type identity. */
const displayType = computed(() => {
  if (showingCurrentType.value && props.detail !== null) return props.detail.type
  return props.selectedType
})

const awaitingTypeDetail = computed(
  () =>
    props.selectedTypeId !== undefined && props.selectedTypeId !== '' && !showingCurrentType.value,
)

const emit = defineEmits<{
  beginCreateItem: []
  beginEditItem: [itemId: string]
  updateType: [id: string, input: UpdateDictionaryType]
  updateItem: [id: string, input: UpdateDictionaryItem]
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

const draft = reactive<{ categoryId: string; name: string; status: DictionaryStatus }>({
  categoryId: '',
  name: '',
  status: 'ENABLED',
})

const canSave = computed(() => {
  const type = props.detail?.type
  if (type === undefined || draft.categoryId === '' || draft.name.trim() === '') return false
  return (
    draft.categoryId !== type.categoryId ||
    draft.name.trim() !== type.name ||
    draft.status !== type.status
  )
})
const dirty = computed(() => {
  const type = props.detail?.type
  return (
    type !== undefined &&
    (draft.categoryId !== type.categoryId ||
      draft.name !== type.name ||
      draft.status !== type.status)
  )
})

function saveType() {
  const type = props.detail?.type
  if (type === undefined || !canSave.value) return
  emit('updateType', type.id, {
    categoryId: draft.categoryId,
    name: draft.name.trim(),
    status: draft.status,
    expectedRevision: type.revision,
  })
}

function toggleItem(item: DictionaryItem) {
  const detail = props.detail
  if (detail === null) return
  emit('updateItem', item.id, {
    status: item.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
    expectedRevision: detail.type.revision,
  })
}

function onName(value: unknown) {
  draft.name = typeof value === 'string' ? value : ''
}

function onCategory(value: unknown) {
  if (typeof value === 'string') draft.categoryId = value
}

function onStatus(value: unknown) {
  if (value === 'ENABLED' || value === 'DISABLED') draft.status = value
}

watch(
  () => props.detail?.type,
  (type) => {
    if (type === undefined) return
    draft.categoryId = type.categoryId
    draft.name = type.name
    draft.status = type.status
  },
  { immediate: true },
)
watch(dirty, (value) => emit('dirtyChange', value), { immediate: true })
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    :aria-busy="loading === true || undefined"
    :class="loading === true ? 'opacity-60 transition-opacity' : undefined"
  >
    <div
      v-if="displayType === undefined"
      class="grid min-h-80 flex-1 place-items-center px-6 text-center"
    >
      <div>
        <Icon icon="lucide:list-tree" class="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p class="m-0 text-sm text-muted-foreground">选择左侧分类或字典类型查看详情</p>
      </div>
    </div>

    <template v-else>
      <header class="flex min-h-16 flex-wrap items-center gap-3 border-b border-border px-5 py-2">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="m-0 truncate text-base font-semibold text-foreground">
              {{ displayType.name }}
            </h2>
            <span
              class="rounded px-1.5 py-0.5 text-[11px]"
              :class="
                displayType.status === 'ENABLED'
                  ? 'bg-success/12 text-success'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{ displayType.status === 'ENABLED' ? '启用' : '停用' }}
            </span>
          </div>
          <p class="m-0 mt-1 truncate font-mono text-xs text-muted-foreground">
            {{ displayType.code }} ·
            {{ showingCurrentType && detail !== null ? detail.items.length : '…' }} 个条目
          </p>
        </div>
        <template v-if="canManage && showingCurrentType">
          <Button variant="soft" :disabled="busy" @click="emit('beginCreateItem')">
            <Icon icon="lucide:plus" class="me-1 size-3.5" />
            新建条目
          </Button>
          <ButtonLoading :loading="busy" :disabled="!canSave" @click="saveType">
            保存资料
          </ButtonLoading>
        </template>
      </header>

      <div
        v-if="awaitingTypeDetail"
        class="grid min-h-80 flex-1 place-items-center px-6 text-center"
        aria-busy="true"
      >
        <div>
          <Icon
            icon="lucide:loader-circle"
            class="mx-auto mb-3 size-8 animate-spin text-muted-foreground/50"
          />
          <p class="m-0 text-sm text-muted-foreground">正在加载字典条目…</p>
        </div>
      </div>

      <div v-else-if="detail !== null" class="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
        <div class="grid items-start gap-4 md:grid-cols-2">
          <label class="grid gap-1.5 text-sm">
            <span class="text-muted-foreground">稳定编码</span>
            <code class="py-1.5 text-sm text-foreground select-text">{{ detail.type.code }}</code>
            <span class="min-h-[1.25rem] text-xs text-muted-foreground">创建后不可修改</span>
          </label>
          <label class="grid gap-1.5 text-sm">
            <span class="text-muted-foreground">类型名称</span>
            <Input :model-value="draft.name" :disabled="!canManage" @update:model-value="onName" />
            <span class="min-h-[1.25rem]" aria-hidden="true"></span>
          </label>
          <label class="grid gap-1.5 text-sm">
            <span class="text-muted-foreground">所属分类</span>
            <Select
              :model-value="draft.categoryId"
              :items="categoryItems"
              :disabled="!canManage"
              @update:model-value="onCategory"
            />
          </label>
          <label class="grid gap-1.5 text-sm">
            <span class="text-muted-foreground">状态</span>
            <Select
              :model-value="draft.status"
              :items="statusItems"
              :disabled="!canManage"
              @update:model-value="onStatus"
            />
          </label>
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <div class="min-w-0 flex-1">
              <h3 class="m-0 text-sm font-medium text-foreground">字典条目</h3>
              <p class="m-0 mt-1 text-xs text-muted-foreground">
                停用条目不再用于新选择，但仍保留编码和当前文字以解析历史数据。
              </p>
            </div>
          </div>

          <div
            v-if="detail.items.length === 0"
            class="grid min-h-36 place-items-center border-y border-border text-center"
          >
            <div>
              <Icon icon="lucide:list-plus" class="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p class="m-0 text-sm text-muted-foreground">该类型暂无字典条目</p>
            </div>
          </div>

          <div v-else class="overflow-hidden border-y border-border">
            <div
              class="grid grid-cols-[minmax(8rem,0.8fr)_minmax(10rem,1fr)_6rem_5rem] gap-3 border-b border-border bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              <span>编码</span>
              <span>展示文字</span>
              <span>状态</span>
              <span class="text-end">操作</span>
            </div>
            <div
              v-for="item in detail.items"
              :key="item.id"
              class="grid grid-cols-[minmax(8rem,0.8fr)_minmax(10rem,1fr)_6rem_5rem] items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <span class="truncate font-mono text-xs text-foreground">{{ item.code }}</span>
              <span class="min-w-0">
                <span class="block truncate text-sm text-foreground">{{ item.label }}</span>
                <span class="block text-[0.68rem] text-muted-foreground">
                  排序 {{ item.sortOrder }}
                </span>
              </span>
              <span
                class="w-fit rounded px-1.5 py-0.5 text-[11px]"
                :class="
                  item.status === 'ENABLED'
                    ? 'bg-success/12 text-success'
                    : 'bg-muted text-muted-foreground'
                "
              >
                {{ item.status === 'ENABLED' ? '启用' : '停用' }}
              </span>
              <div v-if="canManage" class="flex justify-end gap-0.5">
                <ButtonIcon
                  :icon="item.status === 'ENABLED' ? 'lucide:pause' : 'lucide:play'"
                  variant="ghost"
                  :aria-label="item.status === 'ENABLED' ? '停用条目' : '启用条目'"
                  :disabled="busy"
                  @click="toggleItem(item)"
                />
                <ButtonIcon
                  icon="lucide:pencil"
                  variant="ghost"
                  aria-label="编辑条目"
                  :disabled="busy"
                  @click="emit('beginEditItem', item.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
