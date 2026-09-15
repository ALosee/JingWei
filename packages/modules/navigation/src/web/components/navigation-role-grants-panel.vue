<script setup lang="ts">
import { computed, ref } from 'vue'

import { ButtonLoading, Icon, Input, Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { NavigationNode } from '../../shared/index.js'

const props = defineProps<{
  roles: { id: string; code: string; name: string }[]
  roleId: string
  loadedRoleId: string
  grants: string[]
  assignable: NavigationNode[]
  retiredCodes: string[]
  busy: boolean
}>()

const emit = defineEmits<{
  updateRoleId: [id: string]
  loadRole: []
  updateGrants: [codes: string[]]
  save: []
}>()

const filter = ref('')
const roleSearch = ref('')

const roleItems = computed<SelectSingleOptionData<string>[]>(() =>
  props.roles
    .filter((role) => {
      const needle = roleSearch.value.trim().toLowerCase()
      if (needle === '') return true
      return role.name.toLowerCase().includes(needle) || role.code.toLowerCase().includes(needle)
    })
    .map((role) => ({ value: role.id, label: `${role.name} · ${role.code}` })),
)

const filteredAssignable = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  if (needle === '') return props.assignable
  return props.assignable.filter(
    (node) => node.name.toLowerCase().includes(needle) || node.code.toLowerCase().includes(needle),
  )
})

const grantSet = computed(() => new Set(props.grants))

function onRoleIdUpdate(value: unknown): void {
  emit('updateRoleId', typeof value === 'string' ? value : '')
}

function toggleCode(code: string, checked: boolean): void {
  const next = new Set(grantSet.value)
  if (checked) next.add(code)
  else next.delete(code)
  emit('updateGrants', [...next])
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <header>
      <h2 class="m-0 text-sm font-semibold text-foreground">角色导航授权</h2>
      <p class="mb-0 mt-1 text-xs text-muted-foreground">
        只控制导航可见性。目录/分组自动保留；业务 API 权限仍独立鉴权。授权基于当前发布版本的稳定
        code。
      </p>
    </header>

    <div class="grid content-start gap-3">
      <div class="grid gap-2 sm:grid-cols-2">
        <Input v-model="roleSearch" placeholder="搜索角色" />
        <Input v-model="filter" placeholder="过滤可授权节点" />
      </div>
      <Select
        :model-value="roleId"
        :items="roleItems"
        class="w-full min-w-0"
        @update:model-value="onRoleIdUpdate"
      />
      <p v-if="!roleId" class="m-0 text-sm text-muted-foreground">先选择角色。</p>
      <p v-else-if="roleId !== loadedRoleId" class="m-0 text-sm text-muted-foreground">
        正在加载该角色的授权…
      </p>
      <div v-else class="max-h-72 overflow-auto rounded-md border border-border p-2">
        <p v-if="filteredAssignable.length === 0" class="m-0 text-sm text-muted-foreground">
          没有可授权的 PERMISSION 节点。
        </p>
        <label
          v-for="node in filteredAssignable"
          :key="node.code"
          class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
        >
          <input
            type="checkbox"
            class="mt-1"
            :checked="grantSet.has(node.code)"
            :disabled="busy"
            @change="toggleCode(node.code, ($event.target as HTMLInputElement).checked)"
          />
          <span class="min-w-0">
            <span class="block text-sm text-foreground">{{ node.name }}</span>
            <code class="block break-all text-[0.7rem] text-muted-foreground">{{ node.code }}</code>
          </span>
        </label>

        <template v-if="retiredCodes.length > 0">
          <p class="m-0 mt-3 border-t border-border pt-2 text-xs font-medium text-destructive">
            已不在当前可授权节点中
          </p>
          <label
            v-for="code in retiredCodes"
            :key="code"
            class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-destructive hover:bg-destructive/10"
          >
            <input
              type="checkbox"
              class="mt-1"
              :checked="grantSet.has(code)"
              :disabled="busy"
              @change="toggleCode(code, ($event.target as HTMLInputElement).checked)"
            />
            <span class="min-w-0 text-sm">
              请取消：
              <code class="break-all">{{ code }}</code>
              <Icon icon="lucide:triangle-alert" class="ms-1 inline size-3.5" />
            </span>
          </label>
        </template>
      </div>
      <ButtonLoading
        :loading="busy"
        :disabled="!roleId || loadedRoleId !== roleId"
        size="sm"
        class="w-full"
        @click="emit('save')"
      >
        保存角色授权
      </ButtonLoading>
    </div>
  </section>
</template>
