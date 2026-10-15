<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'

import { Button, ButtonLoading, Checkbox, Table, Dialog, Input, dialog, toast } from '@jingwei/ui'
import type { TableColumn } from '@jingwei/ui'

import type { IamRole, RoleMember } from '../../shared/index.js'
import { useRoleMembers } from '../composables/use-role-members.js'

const props = defineProps<{ role: IamRole }>()
const emit = defineEmits<{
  changed: [value: { roleId: string; assignmentCount: number }]
  busyChange: [busy: boolean]
}>()
const {
  members,
  candidates,
  search,
  page,
  candidateSearch,
  candidatePage,
  selected,
  selectedOnPage,
  selectPage,
  additions,
  error,
  addOpen,
  addSnapshot,
  canManage,
  busy,
  loadMembers,
  toggle,
  togglePage,
  openAdd,
  change,
  findMembers,
  findCandidates,
  movePage,
} = useRoleMembers(
  computed(() => props.role),
  (value) => emit('changed', value),
)
watch(busy, (value) => emit('busyChange', value))
onBeforeUnmount(() => emit('busyChange', false))

const statusLabels = {
  ACTIVE: '正常',
  DISABLED: '禁用',
  INVITED: '待激活',
  LOCKED: '锁定',
} as const

const memberColumns = computed<TableColumn<RoleMember>[]>(() => {
  const columns: TableColumn<RoleMember>[] = [
    { accessorKey: 'displayName', header: '用户', minSize: 180 },
    { accessorKey: 'status', header: '账号状态', size: 120 },
  ]
  if (canManage.value) {
    columns.unshift({ id: 'selection', type: 'selection', size: 48 })
    columns.push({ accessorKey: 'id', header: '操作', align: 'end', size: 120 })
  }
  return columns
})
const memberKey = (member: RoleMember) => member.id

function confirmRemove(member?: RoleMember) {
  const snapshot = members.value?.snapshot
  if (snapshot === undefined || busy.value) return
  const ids = member === undefined ? [...selected.value] : [member.id]
  if (ids.length === 0) return
  dialog.warning('解除角色分配', {
    description:
      member === undefined
        ? `确认解除选中的 ${ids.length} 位用户与「${props.role.name}」的角色分配？用户的其他角色保留。`
        : `确认解除「${member.displayName}（${member.username}）」与「${props.role.name}」的角色分配？用户的其他角色保留。`,
    confirmText: '解除分配',
    cancelText: '取消',
    onConfirm: () => {
      void (async () => {
        if (await change('remove', snapshot, ids)) toast.success('已解除角色分配')
      })()
    },
  })
}

function confirmClear() {
  const state = members.value
  if (state === null || state.assignmentCount === 0 || busy.value) return
  dialog.warning('解除全部分配', {
    description: `确认解除「${props.role.name}」全部 ${state.assignmentCount} 位用户的角色分配？包含已禁用用户，不受当前搜索或分页影响。角色、功能权限、导航授权和用户其他角色均保留。`,
    confirmText: '解除全部分配',
    cancelText: '取消',
    onConfirm: () => {
      void (async () => {
        if (await change('clear', state.snapshot)) toast.success('已解除全部用户分配')
      })()
    },
  })
}

async function submitAdd() {
  if (await change('add', addSnapshot.value, [...additions.value]))
    toast.success('用户已添加到角色')
}
</script>

<template>
  <section class="grid gap-4 pt-5" aria-label="角色已分配用户">
    <p v-if="error && !addOpen" role="alert" class="m-0 text-sm text-destructive">{{ error }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <form class="flex min-w-64 flex-1 gap-2" @submit.prevent="findMembers">
        <Input
          v-model="search"
          aria-label="搜索已分配用户"
          placeholder="搜索用户名或显示名"
          class="max-w-sm"
        />
        <Button type="submit" class="shrink-0 whitespace-nowrap" variant="outline" :disabled="busy"
          >搜索</Button
        >
      </form>
      <Button variant="ghost" :disabled="busy" @click="loadMembers">刷新</Button>
      <template v-if="canManage">
        <Button :disabled="busy || members === null || role.status !== 'ACTIVE'" @click="openAdd"
          >添加用户</Button
        >
        <Button variant="outline" :disabled="busy || selected.size === 0" @click="confirmRemove()"
          >解除选中（{{ selected.size }}）</Button
        >
        <Button
          color="destructive"
          variant="ghost"
          :disabled="busy || !members?.assignmentCount"
          @click="confirmClear"
          >解除全部分配</Button
        >
      </template>
    </div>
    <p class="m-0 text-xs text-muted-foreground">
      角色共分配 {{ members?.assignmentCount ?? role.assignmentCount }} 位用户，包含已禁用账号。
      <span v-if="role.status !== 'ACTIVE'">停用角色不能添加用户，仍可解除已有分配。</span>
      <span v-if="!canManage">成员变更需要同时具有管理角色和管理用户权限。</span>
    </p>
    <Table
      :columns="memberColumns"
      :data="members?.members ?? []"
      :row-key="memberKey"
      :selected="selectedOnPage"
      :multiple="true"
      rounded
      bordered
      :content-props="{ 'aria-label': '角色已分配用户列表' }"
      @update:selected="selectPage"
    >
      <template #header-selection="{ checked, disabled, updateChecked }">
        <Checkbox
          :model-value="checked"
          :disabled="busy || disabled"
          :control-props="{ 'aria-label': '选择本页用户' }"
          @update:model-value="updateChecked"
        />
      </template>
      <template #selection="{ row, checked, toggleSelect }">
        <Checkbox
          :model-value="checked"
          :disabled="busy"
          :control-props="{ 'aria-label': `选择用户 ${row.displayName}` }"
          @update:model-value="toggleSelect()"
        />
      </template>
      <template #displayName="{ row }">
        <span class="block font-medium">{{ row.displayName }}</span>
        <span class="text-xs text-muted-foreground">{{ row.username }}</span>
      </template>
      <template #status="{ row }">{{ statusLabels[row.status] }}</template>
      <template #id="{ row }">
        <Button
          variant="ghost"
          :disabled="busy"
          :aria-label="`解除 ${row.displayName} 的角色分配`"
          @click="confirmRemove(row)"
          >解除分配</Button
        >
      </template>
      <template #empty>
        <p class="m-0 p-6 text-center text-muted-foreground">
          {{ members === null ? '正在加载成员' : search ? '没有匹配的用户' : '尚未分配用户' }}
        </p>
      </template>
    </Table>
    <div class="flex items-center justify-end gap-3 text-sm">
      <span class="text-muted-foreground"
        >匹配 {{ members?.total ?? 0 }} 人 · 第 {{ page }} 页</span
      >
      <Button variant="outline" :disabled="busy || page <= 1" @click="movePage(-1)">上一页</Button>
      <Button
        variant="outline"
        :disabled="busy || page * 20 >= (members?.total ?? 0)"
        @click="movePage(1)"
        >下一页</Button
      >
    </div>
    <Dialog v-model:open="addOpen" title="添加角色用户">
      <div class="grid gap-4">
        <p class="m-0 text-sm text-muted-foreground">
          选择正常且尚未分配「{{ role.name }}」的用户。每次最多添加 500 人。
        </p>
        <p v-if="error" role="alert" class="m-0 text-sm text-destructive">{{ error }}</p>
        <form class="flex gap-2" @submit.prevent="findCandidates">
          <Input
            v-model="candidateSearch"
            aria-label="搜索可添加用户"
            placeholder="搜索用户名或显示名"
          /><Button
            type="submit"
            class="shrink-0 whitespace-nowrap"
            variant="outline"
            :disabled="busy"
            >搜索</Button
          >
        </form>
        <Checkbox
          class="px-3 text-sm"
          :control-props="{ 'aria-label': '选择本页候选用户' }"
          :disabled="busy || !candidates?.members.length"
          :model-value="
            !!candidates?.members.length &&
            candidates.members.every((member) => additions.has(member.id))
          "
          @update:model-value="togglePage(true)"
          >选择本页</Checkbox
        >
        <ul class="m-0 max-h-80 list-none overflow-y-auto p-0">
          <li v-for="user in candidates?.members ?? []" :key="user.id">
            <Checkbox
              class="w-full rounded px-3 py-2 hover:bg-muted"
              :control-props="{ 'aria-label': `添加用户 ${user.displayName}` }"
              :model-value="additions.has(user.id)"
              :disabled="busy"
              @update:model-value="toggle(user.id, $event === true, true)"
              >{{ user.displayName
              }}<span class="ml-2 text-xs text-muted-foreground">{{
                user.username
              }}</span></Checkbox
            >
          </li>
          <li
            v-if="(candidates?.members.length ?? 0) === 0"
            class="p-6 text-center text-sm text-muted-foreground"
          >
            {{ candidates === null ? '正在加载候选用户' : '没有可添加的用户' }}
          </li>
        </ul>
        <div class="flex items-center justify-end gap-2 text-sm">
          <span>共 {{ candidates?.total ?? 0 }} 人 · 第 {{ candidatePage }} 页</span
          ><Button
            variant="outline"
            :disabled="busy || candidatePage <= 1"
            @click="movePage(-1, true)"
            >上一页</Button
          ><Button
            variant="outline"
            :disabled="busy || candidatePage * 20 >= (candidates?.total ?? 0)"
            @click="movePage(1, true)"
            >下一页</Button
          >
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="outline" :disabled="busy" @click="addOpen = false">取消</Button
          ><ButtonLoading
            :loading="busy"
            :disabled="additions.size === 0 || busy"
            @click="submitAdd"
            >添加选中（{{ additions.size }}）</ButtonLoading
          >
        </div>
      </div>
    </Dialog>
  </section>
</template>
