<script setup lang="ts">
import { computed } from 'vue'

import {
  Button,
  ButtonLoading,
  Icon,
  Input,
  Select,
  Separator,
  Switch,
  dialog,
  toast,
} from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { CreateIamRole, RoleDataScopeType } from '../../shared/index.js'
import { useIamRoleManagement } from '../composables/use-iam-role-management.js'

const management = useIamRoleManagement()
const {
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
  canManage,
  select,
  beginCreate,
  cancelCreate,
  createRole,
  saveSelected,
  removeSelected,
  togglePermission,
  savePermissions,
} = management

const statusOptions: SelectSingleOptionData[] = [
  { value: 'ACTIVE', label: '启用' },
  { value: 'DISABLED', label: '停用' },
]

const scopeOptions: SelectSingleOptionData[] = [
  { value: 'ALL', label: '全部' },
  { value: 'ORGANIZATION', label: '本组织' },
  { value: 'ORGANIZATION_AND_DESCENDANTS', label: '本组织及下级' },
  { value: 'SELF', label: '仅本人' },
]

const catalogByModule = computed(() => {
  const groups = new Map<string, typeof catalog.value>()
  for (const item of catalog.value) {
    const bucket = groups.get(item.moduleId)
    if (bucket === undefined) groups.set(item.moduleId, [item])
    else bucket.push(item)
  }
  return [...groups.entries()].map(([moduleId, permissions]) => ({ moduleId, permissions }))
})

const canSaveRole = computed(
  () => draftName.value.trim().length > 0 && (!creating.value || draftCode.value.trim().length > 0),
)

function onTogglePermission(code: string, enabled: boolean) {
  const current = selectedPermissions.value.get(code) ?? 'ALL'
  togglePermission(code, enabled, current)
}

function onScopeChange(code: string, scope: RoleDataScopeType) {
  if (!selectedPermissions.value.has(code)) return
  togglePermission(code, true, scope)
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
          <Input v-model="search" placeholder="搜索编码或名称" class="min-w-0 flex-1" />
          <Button v-if="canManage" variant="soft" size="sm" @click="beginCreate">
            <Icon icon="lucide:plus" class="size-4" />
            新建
          </Button>
        </header>
        <ul class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1">
          <li v-for="role in filteredRoles" :key="role.id">
            <button
              type="button"
              class="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors"
              :class="
                role.id === selectedId && !creating
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/60'
              "
              @click="select(role.id)"
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
              >
                {{ role.status === 'ACTIVE' ? '启用' : '停用' }}
              </span>
            </button>
          </li>
          <li
            v-if="filteredRoles.length === 0"
            class="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            暂无角色
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
              {{ creating ? '新建角色' : selected?.name }}
            </h2>
            <p v-if="!creating && selected" class="m-0 truncate text-xs text-muted-foreground">
              {{ selected.code }}
              <span v-if="selected.isSystem"> · 系统角色</span>
              · 已分配 {{ selected.assignmentCount }} 人
            </p>
          </div>
          <template v-if="canManage">
            <template v-if="creating">
              <Button variant="ghost" size="sm" @click="cancelCreate">取消</Button>
              <ButtonLoading size="sm" :loading="busy" :disabled="!canSaveRole" @click="onCreate">
                创建
              </ButtonLoading>
            </template>
            <template v-else>
              <Button
                v-if="!selected?.isSystem && (selected?.assignmentCount ?? 0) === 0"
                variant="soft"
                size="sm"
                class="text-destructive"
                @click="onRemove"
              >
                删除
              </Button>
              <ButtonLoading size="sm" :loading="busy" :disabled="!canSaveRole" @click="onSave">
                保存资料
              </ButtonLoading>
            </template>
          </template>
        </header>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div class="grid items-start gap-3 md:grid-cols-2">
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">编码</span>
              <Input
                v-model="draftCode"
                :disabled="!creating || !canManage"
                placeholder="例如 ops-viewer"
              />
              <span class="min-h-[1.25rem] text-xs text-muted-foreground">创建后不可修改</span>
            </label>
            <label class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">名称</span>
              <Input v-model="draftName" :disabled="!canManage" placeholder="角色名称" />
              <span class="min-h-[1.25rem]" aria-hidden="true"></span>
            </label>
            <label class="grid gap-1.5 text-sm md:col-span-2">
              <span class="text-muted-foreground">描述</span>
              <Input v-model="draftDescription" :disabled="!canManage" placeholder="可选" />
            </label>
            <label v-if="!creating" class="grid gap-1.5 text-sm">
              <span class="text-muted-foreground">状态</span>
              <Select v-model="draftStatus" :items="statusOptions" :disabled="!canManage" />
            </label>
          </div>

          <template v-if="!creating">
            <Separator />
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="m-0 flex-1 text-sm font-medium">功能权限</h3>
                <ButtonLoading
                  v-if="canManage"
                  size="sm"
                  variant="soft"
                  :loading="busy"
                  :disabled="!permissionsDirty"
                  @click="onSavePermissions"
                >
                  保存授权
                </ButtonLoading>
              </div>
              <p class="m-0 text-xs text-muted-foreground">
                权限来自当前产品版本；不支持数据范围的权限固定为「全部」。导航菜单授权在导航模块配置。
              </p>
              <div
                v-for="group in catalogByModule"
                :key="group.moduleId"
                class="rounded-md border border-border"
              >
                <div class="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium">
                  {{ group.moduleId }}
                </div>
                <ul class="m-0 list-none divide-y divide-border">
                  <li
                    v-for="item in group.permissions"
                    :key="item.code"
                    class="flex flex-wrap items-center gap-3 px-3 py-2"
                  >
                    <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                      <Switch
                        :model-value="selectedPermissions.has(item.code)"
                        :disabled="!canManage"
                        @update:model-value="
                          (value: boolean) => onTogglePermission(item.code, value)
                        "
                      />
                      <span class="min-w-0">
                        <span class="block truncate">{{ item.name }}</span>
                        <span class="block truncate text-xs text-muted-foreground">
                          {{ item.code }}
                        </span>
                      </span>
                    </label>
                    <Select
                      v-if="item.supportsDataScope"
                      class="w-44 shrink-0"
                      :model-value="selectedPermissions.get(item.code) ?? 'ALL'"
                      :items="scopeOptions"
                      :disabled="!canManage || !selectedPermissions.has(item.code)"
                      @update:model-value="
                        (value: string | number) =>
                          onScopeChange(item.code, value as RoleDataScopeType)
                      "
                    />
                    <span
                      v-else
                      class="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      无数据范围
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section
        v-else
        class="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
      >
        选择左侧角色，或新建角色
      </section>
    </div>
  </div>
</template>
