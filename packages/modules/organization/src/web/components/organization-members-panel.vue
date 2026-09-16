<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { Button, ButtonIcon, Dialog, dialog, Icon, Select, Switch } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { OrganizationMember, OrganizationPosition } from '../../shared/index.js'

const props = defineProps<{
  orgUnitId: string
  members: OrganizationMember[]
  positions: OrganizationPosition[]
  availableUsers: { id: string; username: string; displayName: string; status: string }[]
  busy: boolean
  canManage: boolean
}>()

const emit = defineEmits<{
  add: [
    input: {
      userId: string
      isPrimary?: boolean
      positionIds?: string[]
    },
  ]
  setPrimary: [userId: string, isPrimary: boolean]
  remove: [userId: string]
  replacePositions: [userId: string, assignments: { positionId: string; isPrimary?: boolean }[]]
  loadDirectory: []
}>()

const addOpen = ref(false)
const editPositionsOpen = ref(false)
const editingUserId = ref('')

const addDraft = reactive({
  userId: '',
  isPrimary: false,
  positionIds: [] as string[],
})

const editDraft = reactive({
  positionIds: [] as string[],
  primaryPositionId: '',
})

const userOptions = computed<SelectSingleOptionData<string>[]>(() =>
  props.availableUsers.map((user) => ({
    value: user.id,
    label: `${user.displayName} · ${user.username}`,
  })),
)

const enabledPositions = computed(() =>
  props.positions.filter((position) => position.status === 'ENABLED'),
)

const editingMember = computed(() =>
  props.members.find((member) => member.userId === editingUserId.value),
)

const canSubmitAdd = computed(() => addDraft.userId !== '')

function openAdd() {
  addDraft.userId = ''
  addDraft.isPrimary = false
  addDraft.positionIds = []
  emit('loadDirectory')
  addOpen.value = true
}

function openEditPositions(member: OrganizationMember) {
  editingUserId.value = member.userId
  editDraft.positionIds = member.positions.map((item) => item.positionId)
  editDraft.primaryPositionId = member.positions.find((item) => item.isPrimary)?.positionId ?? ''
  editPositionsOpen.value = true
}

function onAddUser(value: unknown) {
  addDraft.userId = typeof value === 'string' ? value : ''
}

function toggleAddPosition(positionId: string, checked: boolean) {
  if (checked) {
    if (!addDraft.positionIds.includes(positionId)) addDraft.positionIds.push(positionId)
  } else {
    addDraft.positionIds = addDraft.positionIds.filter((id) => id !== positionId)
  }
}

function toggleEditPosition(positionId: string, checked: boolean) {
  if (checked) {
    if (!editDraft.positionIds.includes(positionId)) editDraft.positionIds.push(positionId)
  } else {
    editDraft.positionIds = editDraft.positionIds.filter((id) => id !== positionId)
    if (editDraft.primaryPositionId === positionId) editDraft.primaryPositionId = ''
  }
}

function submitAdd() {
  if (addDraft.userId === '') return
  emit('add', {
    userId: addDraft.userId,
    isPrimary: addDraft.isPrimary,
    positionIds: [...addDraft.positionIds],
  })
  addOpen.value = false
}

function submitEditPositions() {
  const assignments = editDraft.positionIds.map((positionId) => ({
    positionId,
    ...(editDraft.primaryPositionId === positionId ? { isPrimary: true } : {}),
  }))
  emit('replacePositions', editingUserId.value, assignments)
  editPositionsOpen.value = false
}

function confirmRemove(member: OrganizationMember) {
  dialog.warning('移出组织', {
    description: `确认将「${member.user.displayName || member.user.username}」移出该组织？其在本组织的岗位分配会一并解除。`,
    confirmText: '移出',
    cancelText: '取消',
    onConfirm: () => emit('remove', member.userId),
  })
}

function togglePrimary(member: OrganizationMember, value: unknown) {
  emit('setPrimary', member.userId, value === true)
}

watch(
  () => props.orgUnitId,
  () => {
    addOpen.value = false
    editPositionsOpen.value = false
    editingUserId.value = ''
  },
)
</script>

<template>
  <section class="flex flex-col gap-3">
    <header class="flex flex-wrap items-center gap-2">
      <div class="min-w-0 flex-1">
        <h3 class="m-0 text-sm font-semibold text-foreground">成员</h3>
        <p class="m-0 mt-0.5 text-xs text-muted-foreground">
          {{ members.length }} 名成员 · 每人最多一个主组织
        </p>
      </div>
      <Button v-if="canManage" size="sm" variant="outline" :disabled="busy" @click="openAdd">
        <Icon icon="lucide:user-plus" class="me-1 size-3.5" />
        加入成员
      </Button>
    </header>

    <div
      v-if="members.length === 0"
      class="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
    >
      暂无成员，点击「加入成员」添加
    </div>

    <ul v-else class="m-0 flex flex-col gap-1.5 list-none p-0">
      <li
        v-for="member in members"
        :key="member.userId"
        class="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2"
      >
        <div
          class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary"
        >
          {{ (member.user.displayName || member.user.username).slice(0, 1) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate text-sm font-medium text-foreground">
              {{ member.user.displayName || member.user.username }}
            </span>
            <span
              v-if="member.isPrimary"
              class="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[0.7rem] font-medium text-primary"
            >
              主组织
            </span>
            <span
              v-if="member.user.status !== 'ACTIVE'"
              class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
            >
              {{ member.user.status }}
            </span>
          </div>
          <p class="m-0 mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {{ member.user.username }}
            <template v-if="member.joinedAt"> · 入职 {{ member.joinedAt }}</template>
          </p>
          <div v-if="member.positions.length > 0" class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="position in member.positions"
              :key="position.positionId"
              class="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground"
              :class="position.isPrimary ? 'bg-primary/12 text-primary' : ''"
            >
              {{ position.name }}{{ position.isPrimary ? ' · 主岗' : '' }}
            </span>
          </div>
        </div>
        <div v-if="canManage" class="flex shrink-0 items-center gap-2">
          <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>主</span>
            <Switch
              :model-value="member.isPrimary"
              :disabled="busy"
              @update:model-value="(value: unknown) => togglePrimary(member, value)"
            />
          </label>
          <ButtonIcon
            icon="lucide:briefcase"
            size="sm"
            variant="ghost"
            aria-label="管理岗位"
            :disabled="busy"
            @click="openEditPositions(member)"
          />
          <ButtonIcon
            icon="lucide:user-minus"
            size="sm"
            variant="ghost"
            aria-label="移出组织"
            :disabled="busy"
            @click="confirmRemove(member)"
          />
        </div>
      </li>
    </ul>

    <Dialog v-model:open="addOpen" title="加入成员">
      <form class="grid gap-3" @submit.prevent="submitAdd">
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">用户</span>
          <Select
            :model-value="addDraft.userId"
            :items="userOptions"
            class="w-full"
            placeholder="选择用户"
            @update:model-value="onAddUser"
          />
        </label>
        <label class="flex items-center justify-between gap-3">
          <span class="text-xs text-muted-foreground">设为主组织</span>
          <Switch v-model="addDraft.isPrimary" />
        </label>
        <div v-if="enabledPositions.length > 0" class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">岗位（可选）</span>
          <div class="flex flex-col gap-1.5">
            <label
              v-for="position in enabledPositions"
              :key="position.id"
              class="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                :checked="addDraft.positionIds.includes(position.id)"
                @change="
                  toggleAddPosition(position.id, ($event.target as HTMLInputElement).checked)
                "
              />
              <span>{{ position.name }}</span>
              <span class="font-mono text-xs text-muted-foreground">{{ position.code }}</span>
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" @click="addOpen = false">取消</Button>
          <Button type="submit" size="sm" :disabled="!canSubmitAdd">加入</Button>
        </div>
      </form>
    </Dialog>

    <Dialog v-model:open="editPositionsOpen" title="管理岗位">
      <form class="grid gap-3" @submit.prevent="submitEditPositions">
        <p class="m-0 text-xs text-muted-foreground">
          {{ editingMember?.user.displayName || editingMember?.user.username }} ·
          仅可分配本组织启用岗位
        </p>
        <div v-if="enabledPositions.length === 0" class="text-sm text-muted-foreground">
          本组织暂无启用岗位
        </div>
        <div v-else class="flex flex-col gap-2">
          <label
            v-for="position in enabledPositions"
            :key="position.id"
            class="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              :checked="editDraft.positionIds.includes(position.id)"
              @change="toggleEditPosition(position.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="min-w-0 flex-1 truncate">{{ position.name }}</span>
            <label
              v-if="editDraft.positionIds.includes(position.id)"
              class="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
              @click.stop
            >
              <input
                type="radio"
                name="primary-position"
                :checked="editDraft.primaryPositionId === position.id"
                @change="editDraft.primaryPositionId = position.id"
              />
              主岗
            </label>
          </label>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" @click="editPositionsOpen = false">
            取消
          </Button>
          <Button type="submit" size="sm">保存</Button>
        </div>
      </form>
    </Dialog>
  </section>
</template>
