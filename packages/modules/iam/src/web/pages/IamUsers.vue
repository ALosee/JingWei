<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  Button,
  ButtonLoading,
  Input,
  ManagementListToolbar,
  ManagementWorkspace,
  Select,
  Switch,
  Tabs,
  dialog,
  toast,
} from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { CreateManagedUser } from '../../shared/index.js'
import { useIamUserManagement } from '../composables/use-iam-user-management.js'

const management = useIamUserManagement()
const {
  users,
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
  canManage,
  select,
  beginCreate,
  cancelCreate,
  createUser,
  saveSelected,
  resetSelectedPassword,
  toggleRole,
  saveRoles,
} = management

const mobileDetailOpen = ref(false)
const detailTab = ref<'profile' | 'roles' | 'security'>('profile')
const profileDirty = computed(() => {
  const user = selected.value
  return (
    user !== undefined &&
    (draftDisplayName.value !== user.displayName ||
      draftEmail.value !== (user.email ?? '') ||
      draftPhone.value !== (user.phone ?? '') ||
      draftStatus.value !== (user.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'))
  )
})
const detailTabs = computed(() => [
  { value: 'profile', label: `基本资料${profileDirty.value ? ' · 未保存' : ''}` },
  { value: 'roles', label: `角色分配${rolesDirty.value && !creating.value ? ' · 未保存' : ''}` },
  ...(!creating.value ? [{ value: 'security', label: '账号安全' }] : []),
])

const statusOptions: SelectSingleOptionData[] = [
  { value: 'ACTIVE', label: '正常' },
  { value: 'DISABLED', label: '禁用' },
]

const statusMeta = {
  INVITED: { label: '待激活', className: 'bg-warning/12 text-warning' },
  ACTIVE: { label: '正常', className: 'bg-success/12 text-success' },
  DISABLED: { label: '禁用', className: 'bg-destructive/12 text-destructive' },
  LOCKED: { label: '锁定', className: 'bg-destructive/12 text-destructive' },
} as const

const canCreate = computed(
  () =>
    draftUsername.value.trim().length > 0 &&
    draftDisplayName.value.trim().length > 0 &&
    draftPassword.value.length >= 8,
)
const canSave = computed(() => draftDisplayName.value.trim().length > 0)
const canResetPassword = computed(() => newPassword.value.length >= 8)
const hasUnsavedChanges = computed(() => {
  if (creating.value)
    return (
      draftUsername.value !== '' ||
      draftDisplayName.value !== '' ||
      draftEmail.value !== '' ||
      draftPhone.value !== '' ||
      draftPassword.value !== '' ||
      selectedRoleIds.value.size > 0
    )
  return rolesDirty.value || profileDirty.value || newPassword.value !== ''
})

function afterDiscard(action: () => void) {
  if (!hasUnsavedChanges.value) {
    action()
    return
  }
  dialog.warning('放弃未保存的更改？', {
    description: '当前用户资料、角色分配或重置密码的修改尚未保存。',
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
    detailTab.value = 'profile'
    mobileDetailOpen.value = true
  })
}

function onBeginCreate() {
  if (busy.value) return
  afterDiscard(() => {
    beginCreate()
    detailTab.value = 'profile'
    mobileDetailOpen.value = true
  })
}

function onCancelCreate() {
  cancelCreate()
  mobileDetailOpen.value = false
}

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
  <ManagementWorkspace
    title="用户管理"
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
      <section class="flex h-full min-h-0 flex-col">
        <ManagementListToolbar
          v-model="search"
          title="用户列表"
          :summary="`${users.length} 位用户`"
          search-label="搜索用户"
          search-placeholder="搜索姓名、账号或邮箱"
          create-label="新建用户"
          :can-create="canManage"
          :busy="busy"
          @create="onBeginCreate"
        />
        <ul class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
          <li v-for="user in filteredUsers" :key="user.id">
            <button
              type="button"
              :disabled="busy"
              class="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="
                user.id === selectedId && !creating
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/60'
              "
              @click="onSelect(user.id)"
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
                >{{ statusMeta[user.status].label }}</span
              >
            </button>
          </li>
          <li
            v-if="filteredUsers.length === 0"
            class="px-3 py-8 text-center text-sm text-muted-foreground"
          >
            {{ search ? '没有匹配的用户' : '暂无用户' }}
          </li>
        </ul>
      </section>
    </template>
    <template #detail>
      <section v-if="creating || selected" class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header
          class="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-2"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="m-0 truncate text-base font-semibold">
                {{ creating ? '新建用户' : selected?.displayName }}
              </h2>
              <span
                v-if="selected && !creating"
                class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                :class="statusMeta[selected.status].className"
                >{{ statusMeta[selected.status].label }}</span
              >
            </div>
            <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">
              {{
                creating
                  ? '创建登录账号并分配初始角色'
                  : `${selected?.username} · 已分配 ${selected?.roleCount} 个角色`
              }}
            </p>
          </div>
          <template v-if="canManage">
            <template v-if="creating">
              <Button variant="ghost" @click="onCancelCreate">取消</Button>
              <ButtonLoading :loading="busy" :disabled="!canCreate" @click="onCreate"
                >创建用户</ButtonLoading
              >
            </template>
            <ButtonLoading
              v-else-if="detailTab === 'profile'"
              :loading="busy"
              :disabled="!canSave || !profileDirty"
              @click="onSave"
              >保存资料</ButtonLoading
            >
            <ButtonLoading
              v-else-if="detailTab === 'roles'"
              :loading="busy"
              :disabled="!rolesDirty"
              @click="onSaveRoles"
              >保存角色</ButtonLoading
            >
          </template>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Tabs v-model="detailTab" :items="detailTabs" fill="auto">
            <template #content="{ value }">
              <div
                v-if="value === 'profile'"
                class="grid max-w-3xl items-start gap-4 pt-5 sm:grid-cols-2"
              >
                <label class="grid gap-1.5 text-sm">
                  <span class="text-muted-foreground">用户名</span>
                  <Input v-if="creating" v-model="draftUsername" :disabled="!canManage" />
                  <code v-else class="py-1.5 text-sm text-foreground select-text">{{
                    draftUsername
                  }}</code>
                  <span class="text-xs text-muted-foreground">创建后不可修改</span>
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
                  <span class="text-xs text-muted-foreground">至少 8 位</span>
                </label>
                <label v-else class="grid gap-1.5 text-sm">
                  <span class="text-muted-foreground">状态</span>
                  <Select v-model="draftStatus" :items="statusOptions" :disabled="!canManage" />
                  <span class="text-xs text-muted-foreground">禁用会立即撤销全部会话</span>
                </label>
              </div>
              <div v-else-if="value === 'roles'" class="max-w-3xl pt-5">
                <p class="m-0 mb-3 text-xs text-muted-foreground">
                  {{
                    creating
                      ? '所选角色会在创建账号时一并分配。'
                      : '角色须为启用状态；导航菜单授权在导航模块配置。'
                  }}
                </p>
                <ul class="m-0 list-none divide-y divide-border border-y border-border">
                  <li
                    v-for="role in activeRoles"
                    :key="role.id"
                    class="flex items-center gap-3 py-2.5"
                  >
                    <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
                      <Switch
                        :model-value="selectedRoleIds.has(role.id)"
                        :disabled="!canManage"
                        @update:model-value="(value: boolean) => toggleRole(role.id, value)"
                      />
                      <span class="min-w-0">
                        <span class="block truncate font-medium">{{ role.name }}</span>
                        <span class="block truncate text-xs text-muted-foreground">{{
                          role.code
                        }}</span>
                      </span>
                    </label>
                  </li>
                  <li
                    v-if="activeRoles.length === 0"
                    class="py-5 text-center text-sm text-muted-foreground"
                  >
                    暂无可用角色，请先在角色管理中创建
                  </li>
                </ul>
              </div>
              <div v-else class="max-w-xl space-y-4 pt-5">
                <div>
                  <h3 class="m-0 text-sm font-medium">重置密码</h3>
                  <p class="m-0 mt-1 text-xs text-muted-foreground">
                    重置后，该用户的全部会话将立即撤销。
                  </p>
                </div>
                <label class="grid gap-1.5 text-sm">
                  <span class="text-muted-foreground">新密码</span>
                  <Input v-model="newPassword" type="password" :disabled="!canManage" />
                  <span class="text-xs text-muted-foreground">至少 8 位</span>
                </label>
                <ButtonLoading
                  v-if="canManage"
                  variant="soft"
                  :loading="busy"
                  :disabled="!canResetPassword"
                  @click="onResetPassword"
                  >重置密码并撤销会话</ButtonLoading
                >
              </div>
            </template>
          </Tabs>
        </div>
      </section>
      <div
        v-else
        class="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground"
      >
        选择左侧用户，或新建用户
      </div>
    </template>
  </ManagementWorkspace>
</template>
