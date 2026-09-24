<script setup lang="ts">
import { computed, ref } from 'vue'

import { ManagementWorkspace, dialog, toast } from '@jingwei/ui'

import type {
  CreateDictionaryCategory,
  CreateDictionaryItem,
  CreateDictionaryType,
  UpdateDictionaryCategory,
  UpdateDictionaryItem,
  UpdateDictionaryType,
} from '../../shared/index.js'
import DictionaryCatalog from '../components/dictionary-catalog.vue'
import DictionaryCategoryDetail from '../components/dictionary-category-detail.vue'
import DictionaryCreateForm from '../components/dictionary-create-form.vue'
import DictionaryDetail from '../components/dictionary-detail.vue'
import DictionaryItemEditForm from '../components/dictionary-item-edit-form.vue'
import { useDictionaryManagement } from '../composables/use-dictionary-management.js'

const { feedback, catalog, items, canManage } = useDictionaryManagement()

type CreationState =
  | { kind: 'category'; categoryId: '' }
  | { kind: 'type'; categoryId: string }
  | { kind: 'item'; categoryId: '' }

const creation = ref<CreationState | null>(null)
const editingItemId = ref('')
const mobileDetailOpen = ref(false)
const detailDirty = ref(false)

function afterDiscard(action: () => void) {
  if (!detailDirty.value) {
    action()
    return
  }
  dialog.warning('放弃未保存的更改？', {
    description: '当前字典资料的修改尚未保存。',
    confirmText: '放弃更改',
    cancelText: '继续编辑',
    onConfirm: action,
  })
}

const selectedCategoryTypes = computed(() =>
  catalog.types.value.filter((type) => type.categoryId === catalog.selectedCategoryId.value),
)
const editingItem = computed(() =>
  items.detail.value?.items.find((item) => item.id === editingItemId.value),
)

function beginCreateCategory() {
  if (feedback.busy.value) return
  afterDiscard(() => {
    editingItemId.value = ''
    creation.value = { kind: 'category', categoryId: '' }
    mobileDetailOpen.value = true
  })
}

function beginCreateType(categoryId: string) {
  if (feedback.busy.value) return
  afterDiscard(() => {
    editingItemId.value = ''
    creation.value = { kind: 'type', categoryId }
    mobileDetailOpen.value = true
  })
}

function beginCreateItem() {
  if (items.detail.value === null || feedback.busy.value) return
  afterDiscard(() => {
    editingItemId.value = ''
    creation.value = { kind: 'item', categoryId: '' }
    mobileDetailOpen.value = true
  })
}

function beginEditItem(itemId: string) {
  if (feedback.busy.value) return
  afterDiscard(() => {
    creation.value = null
    editingItemId.value = itemId
    mobileDetailOpen.value = true
  })
}

function cancelCreate() {
  creation.value = null
  mobileDetailOpen.value = false
}

function cancelEditItem() {
  editingItemId.value = ''
}

function selectCategory(id: string) {
  if (feedback.busy.value) return
  if (
    catalog.selectedKind.value === 'category' &&
    catalog.selectedCategoryId.value === id &&
    creation.value === null &&
    editingItemId.value === ''
  ) {
    mobileDetailOpen.value = true
    return
  }
  afterDiscard(() => {
    creation.value = null
    editingItemId.value = ''
    catalog.selectCategory(id)
    mobileDetailOpen.value = true
  })
}

function selectType(id: string) {
  if (feedback.busy.value) return
  if (
    catalog.selectedKind.value === 'type' &&
    catalog.selectedTypeId.value === id &&
    creation.value === null &&
    editingItemId.value === ''
  ) {
    mobileDetailOpen.value = true
    return
  }
  afterDiscard(() => {
    creation.value = null
    editingItemId.value = ''
    catalog.selectType(id)
    mobileDetailOpen.value = true
  })
}

async function onCreateCategory(input: CreateDictionaryCategory) {
  if ((await catalog.createCategory(input)) === undefined) return
  creation.value = null
  toast.success('字典分类已创建')
}

async function onUpdateCategory(id: string, input: UpdateDictionaryCategory) {
  if ((await catalog.updateCategory(id, input)) !== undefined) toast.success('字典分类已更新')
}

async function onDeleteCategory(id: string, revision: number) {
  if ((await catalog.deleteCategory(id, revision)) !== undefined) toast.success('字典分类已删除')
}

async function onCreateType(input: CreateDictionaryType) {
  const detail = await catalog.createType(input)
  if (detail === undefined) return
  items.adoptDetail(detail)
  creation.value = null
  toast.success('字典类型已创建')
}

async function onUpdateType(id: string, input: UpdateDictionaryType) {
  const detail = await catalog.updateType(id, input)
  if (detail === undefined) return
  items.adoptDetail(detail)
  toast.success('字典类型已更新')
}

async function onCreateItem(input: CreateDictionaryItem) {
  if ((await items.createItem(input)) === undefined) return
  creation.value = null
  toast.success('字典条目已创建')
}

async function onUpdateItem(id: string, input: UpdateDictionaryItem) {
  if ((await items.updateItem(id, input)) === undefined) return
  if (editingItemId.value === id) editingItemId.value = ''
  toast.success('字典条目已更新')
}

function onToggleItem(id: string, input: UpdateDictionaryItem) {
  void onUpdateItem(id, input)
}
</script>

<template>
  <ManagementWorkspace
    title="数据字典"
    :mobile-detail-open="mobileDetailOpen"
    @back="mobileDetailOpen = false"
  >
    <template v-if="feedback.error.value" #notice>
      <p
        role="alert"
        class="m-0 shrink-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
      >
        {{ feedback.error.value }}
      </p>
    </template>
    <template #list>
      <DictionaryCatalog
        :groups="catalog.groups.value"
        :selected-kind="catalog.selectedKind.value"
        :selected-category-id="catalog.selectedCategoryId.value"
        :selected-type-id="catalog.selectedTypeId.value"
        :search="catalog.search.value"
        :busy="feedback.busy.value"
        :can-manage="canManage"
        :category-count="catalog.categories.value.length"
        :type-count="catalog.types.value.length"
        @update-search="(value) => (catalog.search.value = value)"
        @select-category="selectCategory"
        @select-type="selectType"
        @begin-create-type="beginCreateType"
        @create-category="beginCreateCategory"
        @delete-category="onDeleteCategory"
      />
    </template>
    <template #detail>
      <DictionaryCreateForm
        v-if="creation !== null"
        :key="`${creation.kind}:${creation.categoryId}`"
        :mode="creation.kind"
        :category-id="creation.categoryId"
        :categories="catalog.categories.value"
        :detail="items.detail.value"
        :busy="feedback.busy.value"
        @cancel="cancelCreate"
        @create-category="onCreateCategory"
        @create-type="onCreateType"
        @create-item="onCreateItem"
        @dirty-change="(value) => (detailDirty = value)"
      />
      <DictionaryItemEditForm
        v-else-if="items.detail.value !== null && editingItem !== undefined"
        :key="editingItem.id"
        :detail="items.detail.value"
        :item="editingItem"
        :busy="feedback.busy.value"
        @cancel="cancelEditItem"
        @update-item="onUpdateItem"
        @dirty-change="(value) => (detailDirty = value)"
      />
      <DictionaryCategoryDetail
        v-else-if="
          catalog.selectedKind.value === 'category' && catalog.selectedCategory.value !== undefined
        "
        :category="catalog.selectedCategory.value"
        :types="selectedCategoryTypes"
        :busy="feedback.busy.value"
        :can-manage="canManage"
        @begin-create-type="beginCreateType"
        @select-type="selectType"
        @update-category="onUpdateCategory"
        @dirty-change="(value) => (detailDirty = value)"
      />
      <DictionaryDetail
        v-else
        :detail="items.detail.value"
        :selected-type-id="catalog.selectedTypeId.value"
        :selected-type="catalog.selectedType.value"
        :categories="catalog.categories.value"
        :busy="feedback.busy.value"
        :loading="items.loadingDetail.value"
        :can-manage="canManage"
        @begin-create-item="beginCreateItem"
        @begin-edit-item="beginEditItem"
        @update-type="onUpdateType"
        @update-item="onToggleItem"
        @dirty-change="(value) => (detailDirty = value)"
      />
    </template>
  </ManagementWorkspace>
</template>
