<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { Button, ButtonIcon, Dialog, dialog, Icon, Input, InputNumber } from '@jingwei/ui'

import type {
  CreateOrganizationPosition,
  OrganizationPosition,
  OrganizationUnitStatus,
  UpdateOrganizationPosition,
} from '../../shared/index.js'

const props = defineProps<{
  orgUnitId: string
  positions: OrganizationPosition[]
  busy: boolean
  canManage: boolean
}>()

const emit = defineEmits<{
  create: [input: CreateOrganizationPosition]
  update: [positionId: string, input: UpdateOrganizationPosition]
  setStatus: [positionId: string, status: OrganizationUnitStatus]
  remove: [positionId: string]
}>()

const dialogOpen = ref(false)
const editingId = ref<string | null>(null)

const draft = reactive({
  code: '',
  name: '',
  sortOrder: 0,
})

const isEditing = computed(() => editingId.value !== null)
const dialogTitle = computed(() => (isEditing.value ? '编辑岗位' : '新建岗位'))

function openCreate() {
  editingId.value = null
  draft.code = ''
  draft.name = ''
  draft.sortOrder = props.positions.length
  dialogOpen.value = true
}

function openEdit(position: OrganizationPosition) {
  editingId.value = position.id
  draft.code = position.code
  draft.name = position.name
  draft.sortOrder = position.sortOrder
  dialogOpen.value = true
}

function onCode(value: unknown) {
  draft.code = typeof value === 'string' ? value : ''
}
function onName(value: unknown) {
  draft.name = typeof value === 'string' ? value : ''
}
function onSortOrder(value: unknown) {
  draft.sortOrder = typeof value === 'number' ? value : Number(value ?? 0)
}

function submit() {
  const payload = {
    code: draft.code.trim(),
    name: draft.name.trim(),
    sortOrder: draft.sortOrder,
  }
  if (payload.code === '' || payload.name === '') return
  if (editingId.value === null) emit('create', payload)
  else emit('update', editingId.value, payload)
  dialogOpen.value = false
}

function confirmRemove(position: OrganizationPosition) {
  dialog.warning('删除岗位', {
    description: `确认删除岗位「${position.name}」？有用户担任时将无法删除。`,
    confirmText: '删除',
    cancelText: '取消',
    onConfirm: () => emit('remove', position.id),
  })
}

function toggleStatus(position: OrganizationPosition) {
  emit('setStatus', position.id, position.status === 'ENABLED' ? 'DISABLED' : 'ENABLED')
}

watch(
  () => props.orgUnitId,
  () => {
    dialogOpen.value = false
    editingId.value = null
  },
)
</script>

<template>
  <section class="flex flex-col gap-3">
    <header class="flex flex-wrap items-center gap-2">
      <div class="min-w-0 flex-1">
        <h3 class="m-0 text-sm font-semibold text-foreground">岗位</h3>
        <p class="m-0 mt-0.5 text-xs text-muted-foreground">
          {{ positions.length }} 个岗位 · 编码在本组织内唯一
        </p>
      </div>
      <Button v-if="canManage" variant="outline" :disabled="busy" @click="openCreate">
        <Icon icon="lucide:plus" class="me-1 size-3.5" />
        新建岗位
      </Button>
    </header>

    <div
      v-if="positions.length === 0"
      class="border-y border-border px-4 py-8 text-center text-sm text-muted-foreground"
    >
      暂无岗位，点击「新建岗位」创建
    </div>

    <ul v-else class="m-0 list-none divide-y divide-border border-y border-border p-0">
      <li
        v-for="position in positions"
        :key="position.id"
        class="flex items-center gap-2 px-1 py-3"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="truncate text-sm font-medium text-foreground"
              :class="position.status === 'DISABLED' ? 'opacity-60' : ''"
            >
              {{ position.name }}
            </span>
            <span
              class="rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
              :class="
                position.status === 'ENABLED'
                  ? 'bg-success/12 text-success'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{ position.status === 'ENABLED' ? '启用' : '停用' }}
            </span>
          </div>
          <p class="m-0 mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {{ position.code }} · 排序 {{ position.sortOrder }}
          </p>
        </div>
        <div v-if="canManage" class="flex shrink-0 items-center gap-0.5">
          <ButtonIcon
            :icon="position.status === 'ENABLED' ? 'lucide:pause' : 'lucide:play'"
            variant="ghost"
            :aria-label="position.status === 'ENABLED' ? '停用' : '启用'"
            :disabled="busy"
            @click="toggleStatus(position)"
          />
          <ButtonIcon
            icon="lucide:pencil"
            variant="ghost"
            aria-label="编辑"
            :disabled="busy"
            @click="openEdit(position)"
          />
          <ButtonIcon
            icon="lucide:trash-2"
            variant="ghost"
            aria-label="删除"
            :disabled="busy"
            @click="confirmRemove(position)"
          />
        </div>
      </li>
    </ul>

    <Dialog v-model:open="dialogOpen" :title="dialogTitle">
      <form class="grid gap-3" @submit.prevent="submit">
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">编码</span>
          <Input
            :model-value="draft.code"
            placeholder="如 rd-manager"
            required
            @update:model-value="onCode"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">名称</span>
          <Input
            :model-value="draft.name"
            placeholder="如 研发经理"
            required
            @update:model-value="onName"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">排序</span>
          <InputNumber
            :model-value="draft.sortOrder"
            :min="-100000"
            :max="100000"
            @update:model-value="onSortOrder"
          />
        </label>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" @click="dialogOpen = false"> 取消 </Button>
          <Button type="submit" :disabled="draft.code.trim() === '' || draft.name.trim() === ''">
            {{ isEditing ? '保存' : '创建' }}
          </Button>
        </div>
      </form>
    </Dialog>
  </section>
</template>
