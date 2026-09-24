<script setup lang="ts">
import { computed } from 'vue'

import { ButtonIcon, ButtonLoading, DropdownMenu, Select } from '@jingwei/ui'
import type { MenuOptionData, SelectSingleOptionData } from '@jingwei/ui'

import type { BrandAdmin, BrandVersion } from '../../shared/index.js'

const props = defineProps<{
  admin: BrandAdmin
  version: BrandVersion | null
  busy: boolean
  readOnly: boolean
  dirty: boolean
  canManage: boolean
  canPublish: boolean
  canSave: boolean
}>()

const emit = defineEmits<{
  selectVersion: [id: string | null]
  createDraftFromVersion: []
  createDefaultDraft: []
  deleteDraft: []
  restoreDefault: []
  save: []
  publish: [rollback: boolean]
}>()

type OverflowAction = 'from-version' | 'from-default' | 'delete-draft' | 'restore-default'

const platformDefaultValue = '__PLATFORM_DEFAULT__'

const versionItems = computed<SelectSingleOptionData<string>[]>(() => [
  {
    value: platformDefaultValue,
    label: '平台内置默认' + (props.admin.publishedVersionId === null ? ' · 当前线上' : ''),
  },
  ...props.admin.versions.map((item) => ({
    value: item.id,
    label:
      `V${item.revision}` +
      (item.status === 'DRAFT' ? ' · 草稿' : '') +
      (item.id === props.admin.publishedVersionId ? ' · 当前线上' : ''),
  })),
])

const isDraft = computed(() => props.version?.status === 'DRAFT')
const isPlatformDefault = computed(() => props.version === null)
const isLiveVersion = computed(
  () => props.version !== null && props.version.id === props.admin.publishedVersionId,
)
const isHistoricalPublished = computed(
  () =>
    props.version !== null &&
    props.version.status === 'PUBLISHED' &&
    props.version.id !== props.admin.publishedVersionId,
)

const statusChip = computed(() => {
  if (props.version === null) {
    return {
      text: props.admin.publishedVersionId === null ? '平台默认 · 当前线上' : '平台默认 · 只读',
      className:
        props.admin.publishedVersionId === null
          ? 'bg-primary/12 text-primary'
          : 'bg-muted text-muted-foreground',
    }
  }
  if (props.dirty) return { text: '草稿 · 未保存', className: 'bg-warning/12 text-warning' }
  if (props.version.status === 'DRAFT')
    return { text: '草稿', className: 'bg-warning/12 text-warning' }
  if (isLiveVersion.value)
    return { text: '当前线上 · 只读', className: 'bg-success/12 text-success' }
  return { text: '已发布 · 只读', className: 'bg-success/12 text-success' }
})

const liveLabel = computed(() => {
  if (props.admin.publishedVersionId === null) return '线上：平台默认'
  const live = props.admin.versions.find((item) => item.id === props.admin.publishedVersionId)
  return live === undefined ? '线上：已发布' : `线上：V${live.revision}`
})

const overflowItems = computed<MenuOptionData<OverflowAction>[]>(() => {
  const items: MenuOptionData<OverflowAction>[] = []
  if (props.version !== null) {
    items.push({ value: 'from-version', label: '基于此版本新建', icon: 'lucide:file-plus-2' })
  }
  if (!isPlatformDefault.value) {
    items.push({ value: 'from-default', label: '从平台默认新建', icon: 'lucide:sparkles' })
  }
  if (isDraft.value) {
    items.push({ value: 'delete-draft', label: '删除草稿', icon: 'lucide:trash-2' })
  }
  if (props.admin.publishedVersionId !== null) {
    items.push({ value: 'restore-default', label: '恢复平台默认', icon: 'lucide:rotate-ccw' })
  }
  return items
})

function onSelectVersion(value: unknown): void {
  if (value === platformDefaultValue) emit('selectVersion', null)
  else if (typeof value === 'string') emit('selectVersion', value)
}

function onOverflowSelect(item: MenuOptionData<OverflowAction>): void {
  switch (item.value) {
    case 'from-version':
      emit('createDraftFromVersion')
      break
    case 'from-default':
      emit('createDefaultDraft')
      break
    case 'delete-draft':
      emit('deleteDraft')
      break
    case 'restore-default':
      emit('restoreDefault')
      break
  }
}
</script>

<template>
  <header
    class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 pb-2"
  >
    <Select
      :model-value="version?.id ?? platformDefaultValue"
      :items="versionItems"
      :disabled="busy"
      class="w-40 shrink-0 focus-within:ring-0!"
      aria-label="配置版本"
      @update:model-value="onSelectVersion"
    />

    <span
      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
      :class="statusChip.className"
    >
      {{ statusChip.text }}
    </span>
    <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">{{ liveLabel }}</span>

    <div class="ms-auto flex shrink-0 items-center gap-2">
      <span v-if="!canManage && !canPublish" class="text-xs text-muted-foreground">无管理权限</span>

      <ButtonLoading
        v-if="isPlatformDefault"
        :loading="busy"
        :disabled="busy || !canManage"
        @click="emit('createDefaultDraft')"
      >
        从平台默认新建草稿
      </ButtonLoading>
      <ButtonLoading
        v-else-if="isHistoricalPublished"
        :loading="busy"
        :disabled="busy || !canPublish"
        @click="emit('publish', true)"
      >
        回滚到此版本
      </ButtonLoading>
      <ButtonLoading
        v-else-if="isDraft && dirty"
        :loading="busy"
        :disabled="!canSave"
        @click="emit('save')"
      >
        保存草稿
      </ButtonLoading>
      <ButtonLoading
        v-else-if="isDraft"
        :loading="busy"
        :disabled="busy || dirty || !canPublish"
        @click="emit('publish', false)"
      >
        发布
      </ButtonLoading>
      <ButtonLoading
        v-else
        :loading="busy"
        :disabled="busy || !canManage"
        @click="emit('createDraftFromVersion')"
      >
        基于此版本新建
      </ButtonLoading>

      <DropdownMenu
        v-if="overflowItems.length > 0"
        :items="overflowItems"
        placement="bottom-end"
        :modal="false"
        :disabled="busy"
        @select="onOverflowSelect"
      >
        <template #trigger>
          <ButtonIcon
            icon="lucide:more-horizontal"
            variant="ghost"
            aria-label="更多操作"
            :disabled="busy"
          />
        </template>
      </DropdownMenu>
    </div>
  </header>
</template>
