<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  Button,
  ButtonLoading,
  Input,
  ManagementListToolbar,
  ManagementWorkspace,
  Select,
  Tabs,
  dialog,
  toast,
} from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { CreateIamRole, RoleDataScopeType } from '../../shared/index.js'
import RolePermissionEditor from '../components/role-permission-editor.vue'
import { useIamRoleManagement } from '../composables/use-iam-role-management.js'

const management = useIamRoleManagement()
const {
  roles,
  filteredRoles,
  catalog,
  selected,
  selectedId,
  search,
  busy,
  error,
  creating,
  draftName,
  draftCode,
  draftDescription,
  draftStatus,
  selectedPermissions,
  permissionsDirty,
  canSavePermissions,
  organizationOptions,
  organizationOptionsError,
  canManage,
  select,
  beginCreate,
  cancelCreate,
  createRole,
  saveSelected,
  removeSelected,
  togglePermission,
  setPermissionScope,
  togglePermissionOrganization,
  savePermissions,
} = management

const mobileDetailOpen = ref(false)
const detailTab = ref<'profile' | 'permissions'>('profile')
const profileDirty = computed(() => {
  const role = selected.value
  return (
    role !== undefined &&
    (draftName.value !== role.name ||
      draftDescription.value !== (role.description ?? '') ||
      draftStatus.value !== role.status)
  )
})
const detailTabs = computed(() => [
  { value: 'profile', label: `基本资料${profileDirty.value ? ' · 未保存' : ''}` },
  ...(!creating.value
    ? [
        {
          value: 'permissions',
          label: `功能权限${permissionsDirty.value ? ' · 未保存' : ''}`,
        },
      ]
    : []),
])

const statusOptions: SelectSingleOptionData[] = [
  { value: 'ACTIVE', label: '启用' },
  { value: 'DISABLED', label: '停用' },
]

const canSaveRole = computed(
  () => draftName.value.trim().length > 0 && (!creating.value || draftCode.value.trim().length > 0),
)
const hasUnsavedChanges = computed(() => {
  if (creating.value)
    return draftCode.value !== '' || draftName.value !== '' || draftDescription.value !== ''
  return permissionsDirty.value || profileDirty.value
})

function afterDiscard(action: () => void) {
  if (!hasUnsavedChanges.value) {
    action()
    return
  }
  dialog.warning('放弃未保存的更改？', {
    description: '当前角色资料或功能权限的修改尚未保存。',
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

function onTogglePermission(code: string, enabled: boolean) {
  const current = selectedPermissions.value.get(code)
  togglePermission(code, enabled, current?.scopeType ?? 'ALL', current?.organizationIds ?? [])
}

function onScopeChange(code: string, scope: RoleDataScopeType) {
  if (!selectedPermissions.value.has(code)) return
  setPermissionScope(code, scope)
}

async function onCreate() {
  const input: CreateIamRole = {
    code: draftCode.value.trim(),
    name: draftName.value.trim(),
    description: draftDescription.value.trim() === '' ? null : draftDescription.value.trim(),
  }
  await createRole(input)
  if (error.value === '') toast.success('角色已创建')
}

async function onSave() {
  await saveSelected()
  if (error.value === '') toast.success('角色已更新')
}

function onRemove() {
  const role = selected.value
  if (role === undefined) return
  dialog.warning('删除角色', {
    description: `确认删除角色「${role.name}」？有用户分配时将无法删除。`,
    confirmText: '删除',
    cancelText: '取消',
    onConfirm: () => {
      void (async () => {
        await removeSelected()
        if (error.value === '') toast.success('角色已删除')
      })()
    },
  })
}

async function onSavePermissions() {
  await savePermissions()
  if (error.value === '') toast.success('角色权限已更新')
}
</script>

<template>
  <ManagementWorkspace
    title="角色管理"
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
          title="角色列表"
          :summary="`${roles.length} 个角色`"
          search-label="搜索角色"
          search-placeholder="搜索角色名称或编码"
          create-label="新建角色"
          :can-create="canManage"
          :busy="busy"
          @create="onBeginCreate"
        />
        <ul class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
          <li v-for="role in filteredRoles" :key="role.id">
            <button
              type="button"
              :disabled="busy"
              class="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="
                role.id === selectedId && !creating
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/60'
              "
              @click="onSelect(role.id)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ role.name }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ role.code }}</span>
              </span>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                :class="
                  role.status === 'ACTIVE'
                    ? 'bg-success/12 text-success'
                    : 'bg-muted text-muted-foreground'
                "
                >{{ role.status === 'ACTIVE' ? '启用' : '停用' }}</span
              >
            </button>
          </li>
          <li
            v-if="filteredRoles.length === 0"
            class="px-3 py-8 text-center text-sm text-muted-foreground"
          >
            {{ search ? '没有匹配的角色' : '暂无角色' }}
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
                {{ creating ? '新建角色' : selected?.name }}
              </h2>
              <span
                v-if="selected && !creating"
                class="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                :class="
                  selected.status === 'ACTIVE'
                    ? 'bg-success/12 text-success'
                    : 'bg-muted text-muted-foreground'
                "
              >
                {{ selected.status === 'ACTIVE' ? '启用' : '停用' }}
              </span>
            </div>
            <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">
              {{
                creating
                  ? '创建后即可配置功能权限'
                  : `${selected?.code}${selected?.isSystem ? ' · 系统角色' : ''} · 已分配 ${selected?.assignmentCount} 人`
              }}
            </p>
          </div>
          <template v-if="canManage">
            <template v-if="creating">
              <Button variant="ghost" @click="onCancelCreate">取消</Button>
              <ButtonLoading :loading="busy" :disabled="!canSaveRole" @click="onCreate"
                >创建角色</ButtonLoading
              >
            </template>
            <template v-else-if="detailTab === 'profile'">
              <Button
                v-if="!selected?.isSystem && (selected?.assignmentCount ?? 0) === 0"
                color="destructive"
                variant="ghost"
                @click="onRemove"
                >删除</Button
              >
              <ButtonLoading
                :loading="busy"
                :disabled="!canSaveRole || !profileDirty"
                @click="onSave"
                >保存资料</ButtonLoading
              >
            </template>
            <ButtonLoading
              v-else
              :loading="busy"
              :disabled="!permissionsDirty || !canSavePermissions"
              @click="onSavePermissions"
              >保存授权</ButtonLoading
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
                  <span class="text-muted-foreground">编码</span>
                  <Input
                    v-if="creating"
                    v-model="draftCode"
                    :disabled="!canManage"
                    placeholder="例如 ops-viewer"
                  />
                  <code v-else class="py-1.5 text-sm text-foreground select-text">{{
                    draftCode
                  }}</code>
                  <span class="text-xs text-muted-foreground">创建后不可修改</span>
                </label>
                <label class="grid gap-1.5 text-sm">
                  <span class="text-muted-foreground">名称</span>
                  <Input v-model="draftName" :disabled="!canManage" placeholder="角色名称" />
                </label>
                <label class="grid gap-1.5 text-sm sm:col-span-2">
                  <span class="text-muted-foreground">描述</span>
                  <Input v-model="draftDescription" :disabled="!canManage" placeholder="可选" />
                </label>
                <label v-if="!creating" class="grid gap-1.5 text-sm">
                  <span class="text-muted-foreground">状态</span>
                  <Select v-model="draftStatus" :items="statusOptions" :disabled="!canManage" />
                </label>
              </div>
              <RolePermissionEditor
                v-else
                :catalog="catalog"
                :selected-permissions="selectedPermissions"
                :organization-options="organizationOptions"
                :organization-options-error="organizationOptionsError"
                :can-manage="canManage"
                @toggle-permission="onTogglePermission"
                @scope-change="onScopeChange"
                @toggle-organization="togglePermissionOrganization"
              />
            </template>
          </Tabs>
        </div>
      </section>
      <div
        v-else
        class="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground"
      >
        选择左侧角色，或新建角色
      </div>
    </template>
  </ManagementWorkspace>
</template>
