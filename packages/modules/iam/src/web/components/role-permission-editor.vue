<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Button, Dialog, Input, Select, Switch } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { PermissionCatalogItem, RoleDataScopeType } from '../../shared/index.js'
import type { PermissionGrantDraft } from '../composables/use-iam-role-management.js'
import type { CustomScopeReferenceOption } from '../scope-reference-directory.js'

const props = defineProps<{
  catalog: PermissionCatalogItem[]
  selectedPermissions: Map<string, PermissionGrantDraft>
  organizationOptions: CustomScopeReferenceOption[]
  organizationOptionsError: string
  canManage: boolean
}>()

const emit = defineEmits<{
  togglePermission: [code: string, enabled: boolean]
  scopeChange: [code: string, scope: RoleDataScopeType]
  toggleOrganization: [code: string, organizationId: string, enabled: boolean]
}>()

const moduleId = ref('')
const search = ref('')
const grantedOnly = ref(false)
const organizationDialogOpen = ref(false)
const organizationPermissionCode = ref('')
const organizationSearch = ref('')

const scopeLabels: Readonly<Record<RoleDataScopeType, string>> = {
  ALL: '全部',
  ORGANIZATION: '本组织',
  ORGANIZATION_AND_DESCENDANTS: '本组织及下级',
  SELF: '仅本人',
  CUSTOM: '自定义组织',
}

const totalGranted = computed(() => props.selectedPermissions.size)
const modules = computed(() => {
  const groups = new Map<
    string,
    { id: string; name: string; permissions: PermissionCatalogItem[] }
  >()
  for (const permission of props.catalog) {
    const group = groups.get(permission.moduleId)
    if (group === undefined) {
      groups.set(permission.moduleId, {
        id: permission.moduleId,
        name: permission.moduleName,
        permissions: [permission],
      })
    } else group.permissions.push(permission)
  }
  const query = search.value.trim().toLocaleLowerCase()
  return [...groups.values()].flatMap((group) => {
    const totalCount = group.permissions.length
    const grantedCount = group.permissions.filter((permission) =>
      props.selectedPermissions.has(permission.code),
    ).length
    const permissions = group.permissions.filter(
      (permission) =>
        (!grantedOnly.value || props.selectedPermissions.has(permission.code)) &&
        (query === '' ||
          `${group.name} ${group.id} ${permission.name} ${permission.code}`
            .toLocaleLowerCase()
            .includes(query)),
    )
    return permissions.length > 0 ? [{ ...group, permissions, totalCount, grantedCount }] : []
  })
})

watch(
  modules,
  (groups) => {
    if (!groups.some((group) => group.id === moduleId.value)) moduleId.value = groups[0]?.id ?? ''
  },
  { immediate: true },
)

const selectedModule = computed(() => modules.value.find((group) => group.id === moduleId.value))
const moduleOptions = computed<SelectSingleOptionData[]>(() =>
  modules.value.map((group) => ({ value: group.id, label: group.name })),
)
const selectedOrganizationPermission = computed(() =>
  props.catalog.find((permission) => permission.code === organizationPermissionCode.value),
)
const visibleOrganizations = computed(() => {
  const query = organizationSearch.value.trim().toLocaleLowerCase()
  if (query === '') return props.organizationOptions
  return props.organizationOptions.filter((organization) =>
    `${organization.name} ${organization.code}`.toLocaleLowerCase().includes(query),
  )
})

function scopeOptionsFor(permission: PermissionCatalogItem): SelectSingleOptionData[] {
  return permission.allowedScopeTypes.map((value) => ({ value, label: scopeLabels[value] }))
}

function isRoleDataScopeType(value: string | number): value is RoleDataScopeType {
  return (
    value === 'ALL' ||
    value === 'ORGANIZATION' ||
    value === 'ORGANIZATION_AND_DESCENDANTS' ||
    value === 'SELF' ||
    value === 'CUSTOM'
  )
}

function setScope(code: string, value: string | number) {
  if (!isRoleDataScopeType(value)) return
  emit('scopeChange', code, value)
  if (value === 'CUSTOM') openOrganizations(code)
}

function openOrganizations(code: string) {
  organizationPermissionCode.value = code
  organizationSearch.value = ''
  organizationDialogOpen.value = true
}

function isOrganizationSelected(organizationId: string): boolean {
  return (
    props.selectedPermissions
      .get(organizationPermissionCode.value)
      ?.organizationIds.includes(organizationId) ?? false
  )
}
</script>

<template>
  <div class="flex min-h-0 flex-col pt-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="m-0 text-sm font-semibold">功能权限</h3>
        <p class="m-0 mt-1 text-xs text-muted-foreground">
          已授权 {{ totalGranted }} / {{ catalog.length }} 项；更改在保存授权后生效。
        </p>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input v-model="grantedOnly" type="checkbox" class="accent-primary" />
        仅看已授权
      </label>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <Input
        v-model="search"
        class="min-w-48 flex-1"
        placeholder="搜索模块、权限名称或编码"
        autocomplete="off"
        clearable
        :control-props="{ role: 'searchbox', 'aria-label': '搜索功能权限' }"
      />
      <Select
        v-if="modules.length > 0"
        v-model="moduleId"
        :items="moduleOptions"
        class="w-full sm:w-48 xl:hidden"
        aria-label="选择模块"
      />
    </div>
    <p v-if="organizationOptionsError" class="m-0 mt-3 text-xs text-warning" role="status">
      {{ organizationOptionsError }}
    </p>
    <div class="mt-4 min-h-0 xl:grid xl:grid-cols-[11rem_minmax(0,1fr)] xl:gap-5">
      <nav
        class="hidden max-h-[60vh] min-h-0 flex-col gap-0.5 overflow-y-auto xl:flex"
        aria-label="权限模块"
      >
        <button
          v-for="group in modules"
          :key="group.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
          :class="
            moduleId === group.id
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          "
          :aria-current="moduleId === group.id ? 'true' : undefined"
          @click="moduleId = group.id"
        >
          <span class="min-w-0 flex-1 truncate">{{ group.name }}</span>
          <span class="shrink-0 text-xs"> {{ group.grantedCount }}/{{ group.totalCount }} </span>
        </button>
      </nav>
      <div class="min-w-0">
        <div
          v-if="selectedModule"
          class="flex items-baseline justify-between gap-2 border-b border-border pb-2"
        >
          <div>
            <h4 class="m-0 text-sm font-medium">{{ selectedModule.name }}</h4>
            <p class="m-0 mt-0.5 text-xs text-muted-foreground">{{ selectedModule.id }}</p>
          </div>
          <span class="text-xs text-muted-foreground"
            >{{ selectedModule.permissions.length }} 项</span
          >
        </div>
        <ul
          v-if="selectedModule"
          class="m-0 max-h-[60vh] list-none divide-y divide-border overflow-y-auto"
        >
          <li
            v-for="item in selectedModule.permissions"
            :key="item.code"
            class="flex flex-wrap items-center gap-3 py-3"
          >
            <label class="flex min-w-44 flex-1 cursor-pointer items-center gap-3 text-sm">
              <Switch
                :model-value="selectedPermissions.has(item.code)"
                :disabled="!canManage"
                @update:model-value="(value: boolean) => emit('togglePermission', item.code, value)"
              />
              <span class="min-w-0">
                <span class="block font-medium">{{ item.name }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ item.code }}</span>
              </span>
            </label>
            <div
              v-if="item.dataScopeProvider !== null"
              class="flex flex-wrap items-center gap-2 pl-9 sm:pl-0"
            >
              <Select
                :model-value="selectedPermissions.get(item.code)?.scopeType ?? 'ALL'"
                :items="scopeOptionsFor(item)"
                :disabled="!canManage || !selectedPermissions.has(item.code)"
                class="w-42"
                :aria-label="`${item.name}的数据范围`"
                @update:model-value="(value: string | number) => setScope(item.code, value)"
              />
              <Button
                v-if="selectedPermissions.get(item.code)?.scopeType === 'CUSTOM'"
                variant="ghost"
                :disabled="!canManage"
                @click="openOrganizations(item.code)"
              >
                选择组织（{{ selectedPermissions.get(item.code)?.organizationIds.length ?? 0 }}）
              </Button>
            </div>
            <span v-else class="pl-9 text-xs text-muted-foreground sm:pl-0">无数据范围</span>
            <span
              v-if="
                selectedPermissions.get(item.code)?.scopeType === 'CUSTOM' &&
                selectedPermissions.get(item.code)?.organizationIds.length === 0
              "
              class="w-full pl-9 text-xs text-warning sm:pl-0"
              >至少选择一个组织后才能保存授权</span
            >
          </li>
        </ul>
        <div v-else class="py-10 text-center text-sm text-muted-foreground">
          {{
            catalog.length === 0
              ? '当前版本暂无可分配的功能权限'
              : grantedOnly
                ? '暂无已授权权限'
                : '没有匹配的权限'
          }}
        </div>
      </div>
    </div>
    <p class="m-0 mt-5 text-xs text-muted-foreground">
      导航菜单授权在导航模块单独配置，不由功能权限决定。
    </p>

    <Dialog
      v-model:open="organizationDialogOpen"
      :title="`选择组织 · ${selectedOrganizationPermission?.name ?? ''}`"
      description="选择自定义范围内的组织。更改将在保存授权后生效。"
      :show-fullscreen="false"
      :show-confirm="false"
      class="!min-w-0 !w-[calc(100vw-2rem)] !max-w-[32rem]"
    >
      <Input
        v-model="organizationSearch"
        placeholder="搜索组织名称或编码"
        autocomplete="off"
        clearable
        :control-props="{ role: 'searchbox', 'aria-label': '搜索组织' }"
      />
      <p v-if="organizationOptionsError" class="m-0 mt-3 text-xs text-warning" role="status">
        {{ organizationOptionsError }}
      </p>
      <div class="mt-3 max-h-72 overflow-y-auto border-y border-border py-1">
        <label
          v-for="organization in visibleOrganizations"
          :key="organization.id"
          class="flex cursor-pointer items-center gap-2 py-1.5 text-sm hover:bg-muted/40"
          :style="{ paddingLeft: organizationSearch ? '0' : `${organization.depth * 14}px` }"
        >
          <input
            type="checkbox"
            :disabled="!canManage"
            :checked="isOrganizationSelected(organization.id)"
            @change="
              emit(
                'toggleOrganization',
                organizationPermissionCode,
                organization.id,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <span class="min-w-0 flex-1 truncate">{{ organization.name }}</span>
          <span class="shrink-0 text-xs text-muted-foreground">{{ organization.code }}</span>
        </label>
        <p
          v-if="visibleOrganizations.length === 0"
          class="m-0 py-6 text-center text-sm text-muted-foreground"
        >
          {{ organizationSearch ? '没有匹配的组织' : '暂无可用组织' }}
        </p>
      </div>
      <div class="mt-4 flex justify-end">
        <Button @click="organizationDialogOpen = false">完成</Button>
      </div>
    </Dialog>
  </div>
</template>
