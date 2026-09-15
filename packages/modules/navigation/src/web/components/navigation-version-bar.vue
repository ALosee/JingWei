<script setup lang="ts">
import { computed } from 'vue'

import { Button, ButtonLoading, Icon, Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

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

const versionItems = computed<SelectSingleOptionData<string>[]>(() =>
  props.admin.versions.map((item) => ({
    value: item.id,
    label:
      `V${item.revision} · ${item.status === 'DRAFT' ? '草稿' : '已发布快照'}` +
      (item.id === props.admin.publishedVersionId ? ' · 当前使用' : ''),
  })),
)

const NONE = '__none__'

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
    items.unshift({ value: current, label: `${current} · 当前值（不在 PUBLIC 内部页中）` })
  }
  return items
})

function onHomeChange(value: unknown): void {
  const next = typeof value === 'string' && value !== NONE ? value : null
  emit('updateHomeCode', next)
}

function onSelectVersion(value: unknown): void {
  emit('selectVersion', typeof value === 'string' ? value : '')
}

function onAuthEntryUpdate(value: unknown): void {
  emit('updateAuthEntry', typeof value === 'string' ? value : '')
}
</script>

<template>
  <section class="flex flex-col gap-4 border-b border-border pb-4">
    <div class="flex flex-wrap items-end gap-3">
      <label class="grid min-w-14rem gap-1.5">
        <span class="text-xs text-muted-foreground">查看版本</span>
        <Select
          :model-value="version?.id ?? ''"
          :items="versionItems"
          :disabled="busy || versionItems.length === 0"
          class="w-full"
          @update:model-value="onSelectVersion"
        />
      </label>
      <Button variant="outline" :disabled="busy" @click="emit('newDraft')">
        基于所选版本创建草稿
      </Button>
      <a
        href="/"
        class="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground no-underline hover:bg-accent hover:text-foreground"
      >
        重新进入工作区
      </a>
    </div>

    <div v-if="version" class="flex flex-wrap items-center gap-3">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <strong class="text-sm text-foreground">
          V{{ version.revision }}
          <span class="font-normal text-muted-foreground"
            >/ 编辑修订 {{ version.editRevision }}</span
          >
        </strong>
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="
            version.status === 'DRAFT' ? 'bg-warning/12 text-warning' : 'bg-success/12 text-success'
          "
        >
          {{ version.status === 'DRAFT' ? '草稿' : '已发布快照' }}
        </span>
        <span
          v-if="version.id === admin.publishedVersionId"
          class="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary"
        >
          当前线上
        </span>
        <span
          v-if="dirty"
          class="rounded-full bg-destructive/12 px-2 py-0.5 text-xs text-destructive"
        >
          未保存
        </span>
        <span
          v-if="readOnly"
          class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          只读
        </span>
        <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {{ version.nodes.length }} 个节点
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ButtonLoading :loading="busy" :disabled="readOnly" size="sm" @click="emit('save')">
          保存草稿
        </ButtonLoading>
        <Button variant="outline" size="sm" :disabled="busy || dirty" @click="emit('validate')">
          校验
        </Button>
        <Button size="sm" :disabled="busy || readOnly || dirty" @click="emit('publish', false)">
          发布
        </Button>
        <Button
          color="destructive"
          variant="soft"
          size="sm"
          :disabled="
            busy || version.status !== 'PUBLISHED' || version.id === admin.publishedVersionId
          "
          @click="emit('publish', true)"
        >
          回滚到此版本
        </Button>
        <Button
          v-if="version.status === 'DRAFT'"
          color="destructive"
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="emit('deleteDraft')"
        >
          删除草稿
        </Button>
      </div>
    </div>

    <div
      v-if="version"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <label class="grid min-w-0 gap-1.5">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon icon="lucide:log-in" class="size-3.5" />
          登录入口 code
        </span>
        <Select
          :model-value="version.authEntryCode"
          :items="authEntryItems"
          :disabled="readOnly || authEntryItems.length === 0"
          class="w-full min-w-0"
          @update:model-value="onAuthEntryUpdate"
        />
        <span v-if="authEntryOptions.length === 0" class="text-xs text-warning">
          当前版本没有启用的 PUBLIC 内部页，无法作为登录入口。
        </span>
      </label>
      <label class="grid min-w-0 gap-1.5">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon icon="lucide:home" class="size-3.5" />
          默认首页
        </span>
        <Select
          :model-value="version.homeCode ?? NONE"
          :items="homeItems"
          :disabled="readOnly"
          class="w-full min-w-0"
          @update:model-value="onHomeChange"
        />
      </label>
    </div>
  </section>
</template>
