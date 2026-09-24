<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button, ButtonIcon, ButtonLoading, DropdownMenu, Popover, Select } from '@jingwei/ui'
import type { MenuOptionData, SelectSingleOptionData } from '@jingwei/ui'

import type { AdminNavigation, NavigationVersion } from '../../shared/index.js'

const props = defineProps<{
  admin: AdminNavigation
  version: NavigationVersion | null
  busy: boolean
  readOnly: boolean
  dirty: boolean
  internalOptions: { code: string; label: string }[]
  authEntryOptions: { code: string; label: string }[]
}>()

const emit = defineEmits<{
  selectVersion: [id: string]
  newDraft: []
  save: []
  validate: []
  publish: [rollback: boolean]
  deleteDraft: []
  updateAuthEntry: [value: string]
  updateHomeCode: [value: string | null]
}>()

type OverflowAction = 'new-draft' | 'rollback' | 'delete-draft' | 'workspace'

const NONE = '__none__'
const entryOpen = ref(false)

const versionItems = computed<SelectSingleOptionData<string>[]>(() =>
  props.admin.versions.map((item) => ({
    value: item.id,
    label:
      `V${item.revision}` +
      (item.status === 'DRAFT' ? ' · 草稿' : '') +
      (item.id === props.admin.publishedVersionId ? ' · 当前线上' : ''),
  })),
)

const homeItems = computed<SelectSingleOptionData<string>[]>(() => [
  { value: NONE, label: '首个可见菜单' },
  ...props.internalOptions.map((item) => ({ value: item.code, label: item.label })),
])

const authEntryItems = computed<SelectSingleOptionData<string>[]>(() => {
  const current = props.version?.authEntryCode
  const items = props.authEntryOptions.map((item) => ({
    value: item.code,
    label: item.label,
  }))
  if (current !== undefined && current !== '' && !items.some((item) => item.value === current)) {
    items.unshift({ value: current, label: `${current} · 当前值` })
  }
  return items
})

const statusChip = computed(() => {
  if (props.version === null) return null
  if (props.dirty) return { text: '草稿 · 未保存', className: 'bg-warning/12 text-warning' }
  if (props.version.status === 'DRAFT')
    return { text: '草稿', className: 'bg-warning/12 text-warning' }
  if (props.version.id === props.admin.publishedVersionId)
    return { text: '当前线上 · 只读', className: 'bg-success/12 text-success' }
  return { text: '已发布 · 只读', className: 'bg-success/12 text-success' }
})

const isDraft = computed(() => props.version?.status === 'DRAFT')

const canRollback = computed(
  () =>
    props.version !== null &&
    props.version.status === 'PUBLISHED' &&
    props.version.id !== props.admin.publishedVersionId,
)

const overflowItems = computed<MenuOptionData<OverflowAction>[]>(() => {
  const items: MenuOptionData<OverflowAction>[] = [
    { value: 'new-draft', label: '基于所选版本创建草稿', icon: 'lucide:file-plus-2' },
  ]
  if (canRollback.value) {
    items.push({ value: 'rollback', label: '回滚到此版本', icon: 'lucide:history' })
  }
  if (isDraft.value) {
    items.push({ value: 'delete-draft', label: '删除草稿', icon: 'lucide:trash-2' })
  }
  items.push({ value: 'workspace', label: '重新进入工作区', icon: 'lucide:refresh-cw' })
  return items
})

const entrySummary = computed(() => {
  const auth = props.version?.authEntryCode
  const home = props.version?.homeCode
  const authText = auth == null || auth === '' ? '未设置登录入口' : `登录 ${auth}`
  const homeText = home == null || home === '' ? '首个可见菜单' : home
  return `${authText} · 首页 ${homeText}`
})

function onSelectVersion(value: unknown): void {
  emit('selectVersion', typeof value === 'string' ? value : '')
}

function onAuthEntryUpdate(value: unknown): void {
  emit('updateAuthEntry', typeof value === 'string' ? value : '')
}

function onHomeChange(value: unknown): void {
  const next = typeof value === 'string' && value !== NONE ? value : null
  emit('updateHomeCode', next)
}

function onOverflowSelect(item: MenuOptionData<OverflowAction>): void {
  switch (item.value) {
    case 'new-draft':
      emit('newDraft')
      break
    case 'rollback':
      emit('publish', true)
      break
    case 'delete-draft':
      emit('deleteDraft')
      break
    case 'workspace':
      window.location.href = '/'
      break
  }
}
</script>

<template>
  <header
    class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 pb-3 pt-1"
  >
    <Select
      :model-value="version?.id ?? ''"
      :items="versionItems"
      :disabled="busy || versionItems.length === 0"
      class="w-36 shrink-0"
      aria-label="查看版本"
      @update:model-value="onSelectVersion"
    />

    <span
      v-if="statusChip"
      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
      :class="statusChip.className"
    >
      {{ statusChip.text }}
    </span>
    <span v-if="version" class="shrink-0 text-xs text-muted-foreground">
      {{ version.nodes.length }} 节点
    </span>

    <div class="mx-1 hidden h-4 w-px shrink-0 bg-border md:block" aria-hidden="true" />

    <Popover
      v-model:open="entryOpen"
      :modal="false"
      :show-arrow="false"
      placement="bottom-start"
      class="w-80 p-4"
      :popup-props="{ 'aria-label': '入口与首页' }"
    >
      <template #trigger>
        <Button
          variant="ghost"
          class="min-w-0 max-w-16rem px-2 font-normal text-muted-foreground"
          :disabled="busy || version === null"
          title="配置登录入口与默认首页"
        >
          <span class="truncate">{{ entrySummary }}</span>
        </Button>
      </template>

      <p class="m-0 mb-3 text-sm font-semibold text-foreground">入口与首页</p>
      <label class="grid gap-1.5">
        <span class="text-xs text-muted-foreground">登录入口 code</span>
        <Select
          :model-value="version?.authEntryCode ?? ''"
          :items="authEntryItems"
          :disabled="readOnly || busy || authEntryItems.length === 0"
          class="w-full"
          @update:model-value="onAuthEntryUpdate"
        />
        <span v-if="authEntryOptions.length === 0" class="text-xs text-warning">
          需要启用的 PUBLIC 内部页作为登录入口。
        </span>
      </label>
      <label class="mt-3 grid gap-1.5">
        <span class="text-xs text-muted-foreground">默认首页</span>
        <Select
          :model-value="version?.homeCode ?? NONE"
          :items="homeItems"
          :disabled="readOnly || busy"
          class="w-full"
          @update:model-value="onHomeChange"
        />
      </label>
    </Popover>

    <div class="ms-auto flex shrink-0 items-center gap-2">
      <Button
        variant="ghost"
        class="text-muted-foreground"
        :disabled="busy || version === null"
        @click="emit('newDraft')"
      >
        新建草稿
      </Button>
      <Button
        variant="outline"
        :disabled="busy || dirty || version === null"
        @click="emit('validate')"
      >
        校验
      </Button>
      <ButtonLoading v-if="isDraft && dirty" :loading="busy" @click="emit('save')">
        保存草稿
      </ButtonLoading>
      <ButtonLoading
        v-else
        :loading="busy"
        :disabled="readOnly || dirty || version === null"
        @click="emit('publish', false)"
      >
        发布
      </ButtonLoading>
      <DropdownMenu
        :items="overflowItems"
        placement="bottom-end"
        :modal="false"
        :disabled="busy || version === null"
        @select="onOverflowSelect"
      >
        <template #trigger>
          <ButtonIcon
            icon="lucide:more-horizontal"
            variant="ghost"
            aria-label="更多操作"
            :disabled="busy || version === null"
          />
        </template>
      </DropdownMenu>
    </div>
  </header>
</template>
