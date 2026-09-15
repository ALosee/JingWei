<script setup lang="ts">
import { computed } from 'vue'

import { Button, ButtonLoading, Icon, Input, Select, Separator, Switch, toast } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { CreateManagedUser } from '../../shared/index.js'
import { useIamUserManagement } from '../composables/use-iam-user-management.js'

const management = useIamUserManagement()
const {
  filteredUsers,
  activeRoles,
  selected,
  selectedId,
  search,
  busy,
  error,
  creating,
  draftUsername,
  draftDisplayName,
  draftEmail,
  draftPhone,
  draftPassword,
  draftStatus,
  selectedRoleIds,
  rolesDirty,
  newPassword,
  select,
  beginCreate,
  cancelCreate,
  createUser,
  saveSelected,
  resetSelectedPassword,
  toggleRole,
  saveRoles,
} = management

const canManage = true

const statusOptions: SelectSingleOptionData[] = [
  { value: 'ACTIVE', label: '正常' },
  { value: 'DISABLED', label: '禁用' },
]

const statusMeta = computed(() => {
  const map = {
    INVITED: { label: '待激活', className: 'bg-warning/12 text-warning' },
    ACTIVE: { label: '正常', className: 'bg-success/12 text-success' },
    DISABLED: { label: '禁用', className: 'bg-destructive/12 text-destructive' },
    LOCKED: { label: '锁定', className: 'bg-destructive/12 text-destructive' },
  } as const
  return map
})

const canCreate = computed(
  () =>
    draftUsername.value.trim().length > 0 &&
    draftDisplayName.value.trim().length > 0 &&
    draftPassword.value.length >= 8,
)
const canSave = computed(() => draftDisplayName.value.trim().length > 0)
const canResetPassword = computed(() => newPassword.value.length >= 8)

async function onCreate() {
  const input: CreateManagedUser = {
    username: draftUsername.value.trim(),
    displayName: draftDisplayName.value.trim(),
    email: draftEmail.value.trim() === '' ? null : draftEmail.value.trim(),
    phone: draftPhone.value.trim() === '' ? null : draftPhone.value.trim(),
    password: draftPassword.value,
    roleIds: [...selectedRoleIds.value],
  }
  await createUser(input)
  if (error.value === '') toast.success('用户已创建')
}

async function onSave() {
  await saveSelected()
  if (error.value === '') toast.success('用户已更新')
}

async function onResetPassword() {
  await resetSelectedPassword()
  if (error.value === '') toast.success('密码已重置，该用户会话已全部撤销')
}

async function onSaveRoles() {
  await saveRoles()
  if (error.value === '') toast.success('用户角色已更新')
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
      class="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]"
    >
      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      >
        <header class="flex items-center gap-2 border-b border-border px-3 py-2">
          <Input v-model="search" placeholder="搜索用户" class="min-w-0 flex-1" />
          <Button v-if="canManage" variant="soft" size="sm" @click="beginCreate">
            <Icon icon="lucide:plus" class="size-4" />
            新建
          </Button>
        </header>
        <ul class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1">
          <li v-for="user in filteredUsers" :key="user.id">
            <button
              type="button"
              class="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors"
              :class="
                user.id === selectedId && !creating
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/60'
              "
              @click="select(user.id)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ user.displayName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{
                  user.username
                }}</span>
              </span>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                :class="statusMeta[user.status].className"
              >
                {{ statusMeta[user.status].label }}
              </span>
            </button>
          </li>
          <li
            v-if="filteredUsers.length === 0"
            class="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            暂无用户
          </li>
        </ul>
      </section>

      <section
        v-if="creating || selected !== undefined"
        class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      >
        <header class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div class="min-w-0 flex-1">
            <h2 class="m-0 truncate text-base font-semibold">
              {{ creating ? '新建用户' : selected?.displayName }}
            </h2>
            <p v-if="!creating && selected" class="m-0 truncate text-xs text-muted-foreground">
              {{ selected.username }}
              <template v-if="selected.email"> · {{ selected.email }}</template>
              · 角色 {{ selected.roleCount }}
            </p>
          </div>
          <template v-if="canManage">
            <template v-if="creating">
              <Button variant="ghost" size="sm" @click="cancelCreate">取消</Button>
              <ButtonLoading size="sm" :loading="busy" :disabled="!canCreate" @click="onCreate">
                创建
              </ButtonLoading>
            </template>
            <ButtonLoading v-else size="sm" :loading="busy" :disabled="!canSave" @click="onSave">
              保存资料
            </ButtonLoading>
          </template>
        </header>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div class="grid items-start gap-3 md:grid-cols-2">
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">用户名</span>
              <Input v-model="draftUsername" :disabled="!creating || !canManage" />
            </label>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">显示名</span>
              <Input v-model="draftDisplayName" :disabled="!canManage" />
            </label>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">邮箱</span>
              <Input v-model="draftEmail" :disabled="!canManage" placeholder="可选" />
            </label>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">手机</span>
              <Input v-model="draftPhone" :disabled="!canManage" placeholder="可选" />
            </label>
            <label v-if="creating" class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">初始密码</span>
              <Input v-model="draftPassword" type="password" :disabled="!canManage" />
              <span class="min-h-[1.25rem] text-xs text-muted-foreground">至少 8 位</span>
            </label>
            <label v-if="!creating" class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">状态</span>
              <Select v-model="draftStatus" :items="statusOptions" :disabled="!canManage" />
              <span class="min-h-[1.25rem] text-xs text-muted-foreground"
                >禁用会立即撤销全部会话</span
              >
            </label>
          </div>

          <template v-if="!creating">
            <Separator />
            <div class="flex flex-wrap items-end gap-2">
              <label class="grid min-w-0 flex-1 gap-1.5 text-sm">
                <span class="text-muted-foreground">重置密码</span>
                <Input v-model="newPassword" type="password" :disabled="!canManage" />
              </label>
              <ButtonLoading
                v-if="canManage"
                size="sm"
                variant="soft"
                :loading="busy"
                :disabled="!canResetPassword"
                @click="onResetPassword"
              >
                重置并踢下线
              </ButtonLoading>
            </div>
          </template>

          <Separator />
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="m-0 flex-1 text-sm font-medium">角色分配</h3>
              <ButtonLoading
                v-if="canManage"
                size="sm"
                variant="soft"
                :loading="busy"
                :disabled="creating || !rolesDirty"
                @click="onSaveRoles"
              >
                保存角色
              </ButtonLoading>
            </div>
            <p class="m-0 text-xs text-muted-foreground">
              角色须为启用状态；导航菜单授权在导航模块配置。
            </p>
            <ul class="m-0 list-none divide-y divide-border rounded-md border border-border">
              <li
                v-for="role in activeRoles"
                :key="role.id"
                class="flex items-center gap-3 px-3 py-2"
              >
                <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    :model-value="selectedRoleIds.has(role.id)"
                    :disabled="!canManage"
                    @update:model-value="(value: boolean) => toggleRole(role.id, value)"
                  />
                  <span class="min-w-0">
                    <span class="block truncate">{{ role.name }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{
                      role.code
                    }}</span>
                  </span>
                </label>
              </li>
              <li
                v-if="activeRoles.length === 0"
                class="px-3 py-4 text-center text-sm text-muted-foreground"
              >
                暂无可用角色，请先在角色管理中创建
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section
        v-else
        class="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
      >
        选择左侧用户，或新建用户
      </section>
    </div>
  </div>
</template>
