<script setup lang="ts">
import { toast } from '@jingwei/ui'

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
  void (async () => {
    await removeUnit(unit.id)
    if (error.value === '') toast.success('组织已删除')
  })()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <p
      v-if="error"
      role="alert"
      class="m-0 shrink-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <div
      class="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]"
    >
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
        @select="select"
        @expand-all="expandAll"
        @collapse-all="collapseAll"
        @add-root="beginCreateRoot"
        @add-child="beginCreateChild"
      />
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
        @cancel-create="cancelCreate"
        @remove="onRemove"
      />
    </div>
  </div>
</template>
