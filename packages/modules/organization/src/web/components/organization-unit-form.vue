<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Button, Icon, Input, InputNumber, Select, Separator, Tabs, toast } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import {
  organizationTypes,
  organizationTypeLabel,
  organizationUnitIcon,
  type CreateOrganizationPosition,
  type CreateOrganizationUnit,
  type OrganizationType,
  type OrganizationUnit,
  type OrganizationUnitStatus,
  type UpdateOrganizationPosition,
  type UpdateOrganizationUnit,
} from '../../shared/index.js'
import { useOrganizationMembers } from '../composables/use-organization-members.js'
import { useOrganizationPositions } from '../composables/use-organization-positions.js'
import OrganizationMembersPanel from './organization-members-panel.vue'
import OrganizationPositionsPanel from './organization-positions-panel.vue'

const props = defineProps<{
  selected: OrganizationUnit | undefined
  creating: boolean
  draftParentId: string | null
  parentOptions: { id: string | null; label: string; depth: number }[]
  canManage: boolean
  busy: boolean
  selectedHasChildren: boolean
  parentPath: { id: string; name: string }[]
}>()

const emit = defineEmits<{
  create: [input: CreateOrganizationUnit]
  update: [input: UpdateOrganizationUnit]
  cancelCreate: []
  remove: []
}>()

const NONE = '__none__'

const detailTab = ref<'info' | 'positions' | 'members'>('info')
const detailTabs = [
  { value: 'info', label: '基本信息' },
  { value: 'positions', label: '岗位' },
  { value: 'members', label: '成员' },
]

const positions = useOrganizationPositions(() => props.selected?.id ?? '')
const positionError = computed(() => positions.error.value)
const members = useOrganizationMembers(() => props.selected?.id ?? '')
const memberError = computed(() => members.error.value)

async function onCreatePosition(input: CreateOrganizationPosition) {
  await positions.createPosition(input)
  if (positions.error.value === '') toast.success('岗位已创建')
}

async function onUpdatePosition(positionId: string, input: UpdateOrganizationPosition) {
  await positions.updatePosition(positionId, input)
  if (positions.error.value === '') toast.success('岗位已更新')
}

async function onSetPositionStatus(positionId: string, status: OrganizationUnitStatus) {
  await positions.setPositionStatus(positionId, status)
}

async function onRemovePosition(positionId: string) {
  await positions.removePosition(positionId)
  if (positions.error.value === '') toast.success('岗位已删除')
}

async function onAddMember(input: { userId: string; isPrimary?: boolean; positionIds?: string[] }) {
  await members.addMember({
    userId: input.userId,
    isPrimary: input.isPrimary,
    positionIds: input.positionIds,
  })
  if (members.error.value === '') toast.success('成员已加入')
}

async function onSetMemberPrimary(userId: string, isPrimary: boolean) {
  await members.setPrimary(userId, isPrimary)
  if (members.error.value === '') toast.success(isPrimary ? '已设为主组织' : '已取消主组织')
}

async function onRemoveMember(userId: string) {
  await members.removeMember(userId)
  if (members.error.value === '') toast.success('成员已移出')
}

async function onReplaceMemberPositions(
  userId: string,
  assignments: { positionId: string; isPrimary?: boolean }[],
) {
  await members.replacePositions(userId, assignments, positions.positions.value)
  if (members.error.value === '') toast.success('岗位已更新')
}

watch(
  () => props.selected?.id,
  () => {
    detailTab.value = 'info'
  },
)
watch(
  () => props.creating,
  (creating) => {
    if (creating) detailTab.value = 'info'
  },
)

const typeItems: SelectSingleOptionData<string>[] = organizationTypes.map((value) => ({
  value,
  label: organizationTypeLabel(value),
}))

const statusItems: SelectSingleOptionData<string>[] = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '禁用' },
]

const parentItems = computed<SelectSingleOptionData<string>[]>(() =>
  props.parentOptions.map((item) => ({
    value: item.id ?? NONE,
    label: item.depth === 0 ? item.label : `${'　'.repeat(item.depth)}${item.label}`,
  })),
)

const code = ref('')
const name = ref('')
const type = ref<OrganizationType>('DEPARTMENT')
const status = ref<OrganizationUnitStatus>('ENABLED')
const sortOrder = ref(0)
const parentId = ref<string>(NONE)

function syncFromSelected() {
  if (props.creating) return
  const unit = props.selected
  if (unit === undefined) return
  code.value = unit.code
  name.value = unit.name
  type.value = unit.type
  status.value = unit.status
  sortOrder.value = unit.sortOrder
  parentId.value = unit.parentId ?? NONE
}

function syncFromDraft() {
  if (!props.creating) return
  code.value = ''
  name.value = ''
  type.value = 'DEPARTMENT'
  status.value = 'ENABLED'
  sortOrder.value = 0
  parentId.value = props.draftParentId ?? NONE
}

watch(() => props.selected?.id, syncFromSelected, { immediate: true })
watch(() => props.creating, syncFromDraft, { immediate: true })
watch(
  () => props.draftParentId,
  () => {
    if (props.creating) parentId.value = props.draftParentId ?? NONE
  },
)

function onCode(value: unknown) {
  code.value = typeof value === 'string' ? value : ''
}
function onName(value: unknown) {
  name.value = typeof value === 'string' ? value : ''
}
function onType(value: unknown) {
  if (typeof value === 'string') type.value = value as OrganizationType
}
function onStatus(value: unknown) {
  if (typeof value === 'string') status.value = value as OrganizationUnitStatus
}
function onParent(value: unknown) {
  parentId.value = typeof value === 'string' ? value : NONE
}
function onSortOrder(value: unknown) {
  sortOrder.value = typeof value === 'number' ? value : Number(value ?? 0)
}

function payload() {
  return {
    parentId: parentId.value === NONE ? null : parentId.value,
    code: code.value.trim(),
    name: name.value.trim(),
    type: type.value,
    status: status.value,
    sortOrder: sortOrder.value,
  }
}

function submit() {
  if (props.creating) emit('create', payload())
  else emit('update', payload())
}

const headerIcon = computed(() =>
  props.creating ? 'lucide:folder-plus' : organizationUnitIcon(props.selected?.type ?? 'OTHER'),
)
const headerTitle = computed(() =>
  props.creating ? '新建组织' : (props.selected?.name ?? '组织详情'),
)
const headerSubtitle = computed(() => {
  if (props.creating) {
    const parent = props.parentOptions.find((item) => item.id === props.draftParentId)
    return parent?.id == null ? '创建根组织' : `上级：${parent.label}`
  }
  return props.selected?.code ?? ''
})
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
    <header class="flex items-center gap-3 border-b border-border px-4 py-3">
      <div
        class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Icon :icon="headerIcon" class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <h2 class="m-0 truncate text-sm font-semibold text-foreground">{{ headerTitle }}</h2>
          <span
            v-if="!creating && selected"
            class="shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
            :class="
              selected.status === 'ENABLED'
                ? 'bg-success/12 text-success'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ selected.status === 'ENABLED' ? '启用' : '停用' }}
          </span>
        </div>
        <p
          v-if="headerSubtitle || (!creating && parentPath.length > 0)"
          class="m-0 mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 truncate text-xs text-muted-foreground"
        >
          <span v-if="headerSubtitle" class="shrink-0 font-mono">{{ headerSubtitle }}</span>
          <template v-if="!creating && parentPath.length > 0">
            <span v-if="headerSubtitle" class="opacity-40" aria-hidden="true">·</span>
            <span class="inline-flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
              <template v-for="(node, index) in parentPath" :key="node.id">
                <span v-if="index > 0" class="opacity-40" aria-hidden="true">/</span>
                <span class="truncate">{{ node.name }}</span>
              </template>
            </span>
          </template>
        </p>
      </div>
      <Button
        v-if="!creating && canManage && selected"
        color="destructive"
        variant="outline"
        size="sm"
        class="shrink-0"
        :disabled="busy || selectedHasChildren"
        :title="selectedHasChildren ? '存在下级组织时不能删除，请改为禁用' : ''"
        @click="emit('remove')"
      >
        <Icon icon="lucide:trash-2" class="me-1 size-3.5" />
        删除
      </Button>
    </header>

    <div class="min-h-0 flex-1 overflow-auto px-4 py-4">
      <div
        v-if="!creating && !selected"
        class="grid h-full min-h-16 place-items-center text-center"
      >
        <div>
          <Icon
            icon="lucide:mouse-pointer-click"
            class="mx-auto mb-2 size-8 text-muted-foreground/40"
          />
          <p class="m-0 text-sm text-muted-foreground">选择左侧组织以查看详情</p>
          <p class="m-0 mt-1 text-xs text-muted-foreground/70">或点击「新建」创建组织单元</p>
        </div>
      </div>

      <div v-else-if="creating" class="grid gap-4">
        <form class="grid gap-4" @submit.prevent="submit">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-1.5">
              <span class="text-xs text-muted-foreground">编码</span>
              <Input
                :model-value="code"
                :disabled="!canManage || busy"
                placeholder="如 HQ / RD-01"
                required
                @update:model-value="onCode"
              />
            </label>
            <label class="grid gap-1.5">
              <span class="text-xs text-muted-foreground">名称</span>
              <Input
                :model-value="name"
                :disabled="!canManage || busy"
                placeholder="组织名称"
                required
                @update:model-value="onName"
              />
            </label>
            <label class="grid gap-1.5">
              <span class="text-xs text-muted-foreground">类型</span>
              <Select
                :model-value="type"
                :items="typeItems"
                :disabled="!canManage || busy"
                class="w-full"
                @update:model-value="onType"
              />
            </label>
            <label class="grid gap-1.5">
              <span class="text-xs text-muted-foreground">状态</span>
              <Select
                :model-value="status"
                :items="statusItems"
                :disabled="!canManage || busy"
                class="w-full"
                @update:model-value="onStatus"
              />
            </label>
            <label class="grid gap-1.5 sm:col-span-2">
              <span class="text-xs text-muted-foreground">上级组织</span>
              <Select
                :model-value="parentId"
                :items="parentItems"
                :disabled="!canManage || busy"
                class="w-full"
                @update:model-value="onParent"
              />
            </label>
            <label class="grid gap-1.5">
              <span class="text-xs text-muted-foreground">同级排序</span>
              <InputNumber
                :model-value="sortOrder"
                :min="-100000"
                :max="100000"
                :disabled="!canManage || busy"
                class="w-full"
                @update:model-value="onSortOrder"
              />
            </label>
          </div>

          <Separator />

          <div class="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" :disabled="!canManage || busy">
              <Icon icon="lucide:plus" class="me-1 size-3.5" />
              创建组织
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              :disabled="busy"
              @click="emit('cancelCreate')"
            >
              取消
            </Button>
          </div>
        </form>
      </div>

      <Tabs v-else v-model="detailTab" :items="detailTabs" size="sm" fill="full">
        <template #content="{ value }">
          <div class="min-w-0 pt-3">
            <form v-if="value === 'info'" class="grid gap-4" @submit.prevent="submit">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1.5">
                  <span class="text-xs text-muted-foreground">编码</span>
                  <Input
                    :model-value="code"
                    :disabled="!canManage || busy"
                    placeholder="如 HQ / RD-01"
                    required
                    @update:model-value="onCode"
                  />
                </label>
                <label class="grid gap-1.5">
                  <span class="text-xs text-muted-foreground">名称</span>
                  <Input
                    :model-value="name"
                    :disabled="!canManage || busy"
                    placeholder="组织名称"
                    required
                    @update:model-value="onName"
                  />
                </label>
                <label class="grid gap-1.5">
                  <span class="text-xs text-muted-foreground">类型</span>
                  <Select
                    :model-value="type"
                    :items="typeItems"
                    :disabled="!canManage || busy"
                    class="w-full"
                    @update:model-value="onType"
                  />
                </label>
                <label class="grid gap-1.5">
                  <span class="text-xs text-muted-foreground">状态</span>
                  <Select
                    :model-value="status"
                    :items="statusItems"
                    :disabled="!canManage || busy"
                    class="w-full"
                    @update:model-value="onStatus"
                  />
                </label>
                <label class="grid gap-1.5 sm:col-span-2">
                  <span class="text-xs text-muted-foreground">上级组织</span>
                  <Select
                    :model-value="parentId"
                    :items="parentItems"
                    :disabled="!canManage || busy"
                    class="w-full"
                    @update:model-value="onParent"
                  />
                </label>
                <label class="grid gap-1.5">
                  <span class="text-xs text-muted-foreground">同级排序</span>
                  <InputNumber
                    :model-value="sortOrder"
                    :min="-100000"
                    :max="100000"
                    :disabled="!canManage || busy"
                    class="w-full"
                    @update:model-value="onSortOrder"
                  />
                </label>
              </div>

              <Separator />

              <div class="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" :disabled="!canManage || busy">
                  <Icon icon="lucide:save" class="me-1 size-3.5" />
                  保存更改
                </Button>
                <p class="m-0 text-xs text-muted-foreground">
                  有子节点、成员或岗位时不可删除，请改为停用
                </p>
              </div>
            </form>

            <div v-else-if="value === 'positions'" class="grid gap-3">
              <OrganizationPositionsPanel
                :org-unit-id="selected?.id ?? ''"
                :positions="positions.positions.value"
                :busy="positions.busy.value || busy"
                :can-manage="canManage"
                @create="onCreatePosition"
                @update="onUpdatePosition"
                @set-status="onSetPositionStatus"
                @remove="onRemovePosition"
              />
              <p v-if="positionError" class="m-0 text-xs text-destructive whitespace-pre-wrap">
                {{ positionError }}
              </p>
            </div>

            <div v-else class="grid gap-3">
              <OrganizationMembersPanel
                :org-unit-id="selected?.id ?? ''"
                :members="members.members.value"
                :positions="positions.positions.value"
                :available-users="members.availableUsers.value"
                :busy="members.busy.value || busy"
                :can-manage="canManage"
                @add="onAddMember"
                @set-primary="onSetMemberPrimary"
                @remove="onRemoveMember"
                @replace-positions="onReplaceMemberPositions"
                @load-directory="() => void members.loadDirectory()"
              />
              <p v-if="memberError" class="m-0 text-xs text-destructive whitespace-pre-wrap">
                {{ memberError }}
              </p>
              <p
                v-if="members.directoryError.value"
                class="m-0 text-xs text-destructive whitespace-pre-wrap"
              >
                {{ members.directoryError.value }}
              </p>
            </div>
          </div>
        </template>
      </Tabs>
    </div>
  </section>
</template>
