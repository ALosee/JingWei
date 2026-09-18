<script setup lang="ts">
import { computed } from 'vue'

import { Button, Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import type { BrandAdmin, BrandVersion } from '../../shared/index.js'

const props = defineProps<{
  admin: BrandAdmin
  version: BrandVersion | null
  busy: boolean
  readOnly: boolean
  dirty: boolean
  canManage: boolean
}>()

const emit = defineEmits<{
  selectVersion: [id: string | null]
  createDraftFromVersion: []
}>()

const platformDefaultValue = '__PLATFORM_DEFAULT__'
const versionItems = computed<SelectSingleOptionData<string>[]>(() => [
  {
    value: platformDefaultValue,
    label: '平台内置默认' + (props.admin.publishedVersionId === null ? ' · 当前使用' : ''),
  },
  ...props.admin.versions.map((item) => ({
    value: item.id,
    label:
      `V${item.revision} · ${item.status === 'DRAFT' ? '草稿' : '已发布快照'}` +
      (item.id === props.admin.publishedVersionId ? ' · 当前使用' : ''),
  })),
])

function onSelectVersion(value: unknown): void {
  if (value === platformDefaultValue) emit('selectVersion', null)
  else if (typeof value === 'string') emit('selectVersion', value)
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <label class="grid min-w-14rem flex-1 gap-1.5">
        <span class="text-xs text-muted-foreground">配置版本</span>
        <Select
          :model-value="version?.id ?? platformDefaultValue"
          :items="versionItems"
          :disabled="busy"
          class="w-full"
          @update:model-value="onSelectVersion"
        />
      </label>
      <Button
        v-if="version"
        variant="outline"
        size="sm"
        :disabled="busy || !canManage"
        @click="emit('createDraftFromVersion')"
      >
        基于所选版本新建草稿
      </Button>
    </div>

    <div v-if="version" class="flex flex-wrap items-center gap-2">
      <span
        v-if="admin.publishedVersionId === null"
        class="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary"
      >
        当前线上：平台默认
      </span>
      <strong class="text-sm text-foreground">
        V{{ version.revision }}
        <span class="font-normal text-muted-foreground">/ 编辑修订 {{ version.editRevision }}</span>
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
      <span v-if="readOnly" class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        只读
      </span>
      <span
        v-if="version.publishedAt"
        class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      >
        发布于 {{ new Date(version.publishedAt).toLocaleString('zh-CN', { hour12: false }) }}
      </span>
      <span
        v-if="!canManage"
        class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      >
        无管理权限
      </span>
    </div>
    <div v-else class="flex flex-wrap items-center gap-2">
      <span class="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">
        {{ admin.publishedVersionId === null ? '当前线上' : '默认配置' }}
      </span>
      <strong class="text-sm text-foreground">平台内置默认品牌</strong>
      <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">只读</span>
    </div>
  </section>
</template>
