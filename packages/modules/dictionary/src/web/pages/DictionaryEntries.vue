<script setup lang="ts">
import { computed, ref } from 'vue'

import { toast } from '@jingwei/ui'

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

const selectedCategoryTypes = computed(() =>
  catalog.types.value.filter((type) => type.categoryId === catalog.selectedCategoryId.value),
)
const editingItem = computed(() =>
  items.detail.value?.items.find((item) => item.id === editingItemId.value),
)

function beginCreateCategory() {
  editingItemId.value = ''
  creation.value = { kind: 'category', categoryId: '' }
}

function beginCreateType(categoryId: string) {
  editingItemId.value = ''
  creation.value = { kind: 'type', categoryId }
}

function beginCreateItem() {
  if (items.detail.value === null) return
  editingItemId.value = ''
  creation.value = { kind: 'item', categoryId: '' }
}

function beginEditItem(itemId: string) {
  creation.value = null
  editingItemId.value = itemId
}

function cancelCreate() {
  creation.value = null
}

function cancelEditItem() {
  editingItemId.value = ''
}

function selectCategory(id: string) {
  creation.value = null
  editingItemId.value = ''
  catalog.selectCategory(id)
}

function selectType(id: string) {
  creation.value = null
  editingItemId.value = ''
  catalog.selectType(id)
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
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <p
      v-if="feedback.error.value"
      role="alert"
      class="m-0 shrink-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
    >
      {{ feedback.error.value }}
    </p>

    <div
      class="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)]"
    >
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
        @begin-create-category="beginCreateCategory"
        @begin-create-type="beginCreateType"
        @delete-category="onDeleteCategory"
      />
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
      />
      <DictionaryItemEditForm
        v-else-if="items.detail.value !== null && editingItem !== undefined"
        :key="editingItem.id"
        :detail="items.detail.value"
        :item="editingItem"
        :busy="feedback.busy.value"
        @cancel="cancelEditItem"
        @update-item="onUpdateItem"
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
        @update-item="onUpdateItem"
      />
    </div>
  </div>
</template>
