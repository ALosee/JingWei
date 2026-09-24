<script setup lang="ts">
import { ref } from 'vue'

import { ManagementWorkspace, dialog, toast } from '@jingwei/ui'

import type {
  CreateOrganizationUnit,
  OrganizationUnit,
  UpdateOrganizationUnit,
} from '../../shared/index.js'
import OrganizationStructureTree from '../components/organization-structure-tree.vue'
import OrganizationUnitForm from '../components/organization-unit-form.vue'
import { useOrganizationManagement } from '../composables/use-organization-management.js'

const management = useOrganizationManagement()
const {
  units,
  tree,
  canManage,
  selected,
  selectedId,
  selectedHasChildren,
  parentPath,
  parentOptions,
  search,
  expandedIds,
  busy,
  error,
  creating,
  draftParentId,
  select,
  setExpanded,
  expandAll,
  collapseAll,
  beginCreateRoot,
  beginCreateChild,
  cancelCreate,
  createUnit,
  updateUnit,
  removeUnit,
} = management

const mobileDetailOpen = ref(false)
const detailDirty = ref(false)

function afterDiscard(action: () => void) {
  if (!detailDirty.value) {
    action()
    return
  }
  dialog.warning('放弃未保存的更改？', {
    description: '当前组织资料的修改尚未保存。',
    confirmText: '放弃更改',
    cancelText: '继续编辑',
    onConfirm: action,
  })
}

function onSelect(id: string) {
  if (busy.value) return
  if (selectedId.value === id && !creating.value) {
    mobileDetailOpen.value = true
    return
  }
  afterDiscard(() => {
    select(id)
    mobileDetailOpen.value = true
  })
}

function onCreateRoot() {
  if (busy.value) return
  afterDiscard(() => {
    beginCreateRoot()
    mobileDetailOpen.value = true
  })
}

function onCreateChild(id: string) {
  if (busy.value) return
  afterDiscard(() => {
    beginCreateChild(id)
    mobileDetailOpen.value = true
  })
}

function onCancelCreate() {
  cancelCreate()
  mobileDetailOpen.value = false
}

async function onCreate(input: CreateOrganizationUnit) {
  await createUnit(input)
  if (error.value === '') toast.success('组织已创建')
}

async function onUpdate(input: UpdateOrganizationUnit) {
  const id = selectedId.value
  if (id === '') return
  await updateUnit(id, input)
  if (error.value === '') toast.success('组织已更新')
}

function onRemove() {
  const unit: OrganizationUnit | undefined = selected.value
  if (unit === undefined) return
  dialog.warning('删除组织', {
    description: `确认删除「${unit.name}」？有下级、岗位或成员时将无法删除。`,
    confirmText: '删除',
    cancelText: '取消',
    onConfirm: () => {
      void (async () => {
        await removeUnit(unit.id)
        if (error.value === '') {
          mobileDetailOpen.value = false
          toast.success('组织已删除')
        }
      })()
    },
  })
}
</script>

<template>
  <ManagementWorkspace
    title="组织架构"
    :mobile-detail-open="mobileDetailOpen"
    @back="mobileDetailOpen = false"
  >
    <template v-if="error" #notice>
      <p
        role="alert"
        class="m-0 shrink-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
      >
        {{ error }}
      </p>
    </template>
    <template #list>
      <OrganizationStructureTree
        :tree="tree"
        :selected-id="selectedId"
        :search="search"
        :expanded-ids="expandedIds"
        :busy="busy"
        :can-manage="canManage"
        :unit-count="units.length"
        @update-search="(value) => (search = value)"
        @update-expanded-ids="setExpanded"
        @select="onSelect"
        @expand-all="expandAll"
        @collapse-all="collapseAll"
        @create-root="onCreateRoot"
        @add-child="onCreateChild"
      />
    </template>
    <template #detail>
      <OrganizationUnitForm
        :selected="selected"
        :creating="creating"
        :draft-parent-id="draftParentId"
        :parent-options="parentOptions"
        :can-manage="canManage"
        :busy="busy"
        :selected-has-children="selectedHasChildren"
        :parent-path="parentPath"
        @create="onCreate"
        @update="onUpdate"
        @cancel-create="onCancelCreate"
        @remove="onRemove"
        @dirty-change="(value) => (detailDirty = value)"
      />
    </template>
  </ManagementWorkspace>
</template>
