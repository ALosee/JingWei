<script setup lang="ts">
import { computed } from 'vue'

import { Icon, Input, InputNumber, Select, Separator } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import {
  isContainer,
  isInternal,
  isIconifyName,
  navigationAccessModes,
  navigationNodeTypes,
  resolveNavigationIcon,
  type NavigationNode,
  type NavigationNodeType,
} from '../../shared/index.js'

const props = defineProps<{
  selected: NavigationNode | undefined
  readOnly: boolean
  paramsText: string
  queryText: string
  routeOptions: {
    key: string
    layout: 'base' | 'blank'
    allowedLayouts: ('base' | 'blank')[]
    allowedAccessModes: readonly ('PUBLIC' | 'AUTHENTICATED' | 'PERMISSION')[]
  }[]
  parentOptions: { id: string | null; label: string; depth: number }[]
  dirtyCodeWarning: boolean
}>()

const emit = defineEmits<{
  changeType: [type: NavigationNodeType]
  changeRoute: [routeKey: string | null]
  changeParent: [parentId: string | null]
  updateNode: [patch: Partial<NavigationNode>]
  updateParamsText: [value: string]
  updateQueryText: [value: string]
  markDirty: []
}>()

const typeItems: SelectSingleOptionData<string>[] = navigationNodeTypes.map((value) => ({
  value,
  label: typeLabelOf(value),
}))

const statusItems: SelectSingleOptionData<string>[] = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '禁用' },
]

const accessItems: SelectSingleOptionData<string>[] = navigationAccessModes.map((value) => ({
  value,
  label: accessLabelOf(value),
}))

const NONE = '__none__'

const parentItems = computed<SelectSingleOptionData<string>[]>(() =>
  props.parentOptions.map((item) => ({
    value: item.id ?? NONE,
    label: item.depth === 0 ? item.label : `${'　'.repeat(item.depth)}${item.label}`,
  })),
)

const routeItems = computed<SelectSingleOptionData<string>[]>(() => [
  { value: NONE, label: '选择页面' },
  ...props.routeOptions.map((route) => ({ value: route.key, label: route.key })),
])

const allowedLayouts = computed(() => {
  const node = props.selected
  if (node?.routeKey == null) return ['base', 'blank'] as const
  return (
    props.routeOptions.find((route) => route.key === node.routeKey)?.allowedLayouts ?? [
      'base',
      'blank',
    ]
  )
})

const layoutItems = computed<SelectSingleOptionData<string>[]>(() =>
  allowedLayouts.value.map((value) => ({ value, label: value })),
)

const externalTargetItems: SelectSingleOptionData<string>[] = [
  { value: 'BLANK', label: '新窗口 BLANK' },
  { value: 'SELF', label: '当前窗口 SELF' },
]

function typeLabelOf(value: NavigationNodeType): string {
  const map: Record<NavigationNodeType, string> = {
    DIRECTORY: 'DIRECTORY · 目录',
    GROUP: 'GROUP · 分组',
    MENU: 'MENU · 菜单',
    PAGE: 'PAGE · 页面（侧栏隐藏）',
    EXTERNAL_LINK: 'EXTERNAL_LINK · 外链',
  }
  return map[value]
}

function accessLabelOf(value: string): string {
  const map: Record<string, string> = {
    PUBLIC: 'PUBLIC · 公开',
    AUTHENTICATED: 'AUTHENTICATED · 需登录',
    PERMISSION: 'PERMISSION · 按角色授权',
  }
  return map[value] ?? value
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function onName(value: unknown): void {
  emit('updateNode', { name: asString(value) })
}

function onCode(value: unknown): void {
  emit('updateNode', { code: asString(value) })
}

function onType(value: unknown): void {
  if (typeof value !== 'string') return
  emit('changeType', value as NavigationNodeType)
}

function onStatus(value: unknown): void {
  emit('updateNode', { status: value === 'DISABLED' ? 'DISABLED' : 'ENABLED' })
}

function onParent(value: unknown): void {
  const next = typeof value === 'string' && value !== NONE ? value : null
  emit('changeParent', next)
}

function onSortOrder(value: unknown): void {
  const next = typeof value === 'number' && Number.isFinite(value) ? value : 0
  emit('updateNode', { sortOrder: next })
}

function onIcon(value: unknown): void {
  const next = asString(value)
  emit('updateNode', { icon: next === '' ? null : next })
}

function onAccess(value: unknown): void {
  emit('updateNode', {
    accessMode:
      value === 'PUBLIC' || value === 'AUTHENTICATED' || value === 'PERMISSION' ? value : null,
  })
}

function onRoute(value: unknown): void {
  const next = typeof value === 'string' && value !== NONE ? value : null
  emit('changeRoute', next)
}

function onLayout(value: unknown): void {
  emit('updateNode', { layout: value === 'blank' ? 'blank' : 'base' })
}

function onPath(value: unknown): void {
  emit('updateNode', { path: asString(value) })
}

function onHref(value: unknown): void {
  emit('updateNode', { href: asString(value) })
}

function onExternalTarget(value: unknown): void {
  emit('updateNode', { externalTarget: value === 'SELF' ? 'SELF' : 'BLANK' })
}

function onParamsInput(event: Event): void {
  emit('updateParamsText', (event.target as HTMLTextAreaElement).value)
}

function onQueryInput(event: Event): void {
  emit('updateQueryText', (event.target as HTMLTextAreaElement).value)
}

function defaultIconForType(type: NavigationNodeType): string {
  return resolveNavigationIcon(null, type)
}

const iconPreview = computed(() => {
  const node = props.selected
  if (node === undefined) return null
  const raw = (node.icon ?? '').trim()
  if (raw === '') {
    return {
      icon: defaultIconForType(node.type),
      usingDefault: true,
      label: '类型默认图标',
    }
  }
  if (!isIconifyName(raw)) {
    return {
      icon: null,
      usingDefault: false,
      label: '',
    }
  }
  return {
    icon: raw,
    usingDefault: false,
    label: raw,
  }
})
</script>

<template>
  <section class="flex min-h-0 flex-col gap-4">
    <header>
      <h2 class="m-0 text-sm font-semibold text-foreground">节点属性</h2>
      <p v-if="selected" class="mb-0 mt-1 truncate text-xs text-muted-foreground">
        {{ selected.code }}
      </p>
      <p v-else class="mb-0 mt-1 text-xs text-muted-foreground">在左侧选择一个节点开始编辑。</p>
    </header>

    <p
      v-if="!selected"
      class="m-0 rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground"
    >
      选择一个节点编辑。
    </p>

    <div v-else class="grid min-h-0 gap-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">名称</span>
          <Input :model-value="selected.name" :disabled="readOnly" @update:model-value="onName" />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">稳定 code</span>
          <Input :model-value="selected.code" :disabled="readOnly" @update:model-value="onCode" />
          <span v-if="dirtyCodeWarning" class="text-xs text-warning">
            修改 code 等于新建授权资源，角色需重新分配。
          </span>
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">类型</span>
          <Select
            :model-value="selected.type"
            :items="typeItems"
            :disabled="readOnly"
            class="w-full"
            @update:model-value="onType"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">状态</span>
          <Select
            :model-value="selected.status"
            :items="statusItems"
            :disabled="readOnly"
            class="w-full"
            @update:model-value="onStatus"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">父节点</span>
          <Select
            :model-value="selected.parentId ?? NONE"
            :items="parentItems"
            :disabled="readOnly"
            class="w-full"
            @update:model-value="onParent"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">同级排序</span>
          <InputNumber
            :model-value="selected.sortOrder"
            :min="-100000"
            :max="100000"
            :step="1"
            :disabled="readOnly"
            class="w-full"
            @update:model-value="onSortOrder"
          />
        </label>
        <label class="grid gap-1.5 sm:col-span-2">
          <span class="text-xs text-muted-foreground">图标 key</span>
          <div class="flex min-w-0 items-stretch gap-2">
            <Input
              :model-value="selected.icon ?? ''"
              :disabled="readOnly"
              class="min-w-0 flex-1"
              placeholder="lucide:settings"
              @update:model-value="onIcon"
            />
            <div
              v-if="iconPreview"
              class="flex w-40 shrink-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5"
              :title="iconPreview.label || undefined"
            >
              <span
                class="grid size-7 shrink-0 place-items-center rounded-md bg-background text-foreground shadow-xs"
              >
                <Icon v-if="iconPreview.icon" :icon="iconPreview.icon" class="size-4" />
              </span>
              <span class="min-w-0 truncate text-[0.7rem] text-muted-foreground">
                {{ iconPreview.usingDefault ? '默认' : iconPreview.label }}
              </span>
            </div>
          </div>
          <span class="text-[0.7rem] text-muted-foreground">
            仅支持完整 iconify 名，例如 lucide:settings；留空按类型默认。无效名称不会渲染图标。
          </span>
        </label>
      </div>

      <template v-if="!isContainer(selected)">
        <Separator>访问</Separator>
        <label class="grid gap-1.5">
          <span class="text-xs text-muted-foreground">访问模式</span>
          <Select
            :model-value="selected.accessMode ?? 'PERMISSION'"
            :items="accessItems"
            :disabled="readOnly"
            class="w-full"
            @update:model-value="onAccess"
          />
        </label>
      </template>

      <template v-if="isInternal(selected)">
        <Separator>内部页面</Separator>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="grid gap-1.5">
            <span class="text-xs text-muted-foreground">routeKey</span>
            <Select
              :model-value="selected.routeKey ?? NONE"
              :items="routeItems"
              :disabled="readOnly"
              class="w-full"
              @update:model-value="onRoute"
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs text-muted-foreground">布局</span>
            <Select
              :model-value="selected.layout ?? 'base'"
              :items="layoutItems"
              :disabled="readOnly"
              class="w-full"
              @update:model-value="onLayout"
            />
          </label>
          <label class="grid gap-1.5 sm:col-span-2">
            <span class="text-xs text-muted-foreground">路径模式</span>
            <Input
              :model-value="selected.path ?? ''"
              :disabled="readOnly"
              placeholder="/example/:id"
              @update:model-value="onPath"
            />
          </label>
        </div>
        <div class="grid gap-4">
          <label class="grid gap-1.5">
            <span class="flex items-center gap-1 text-xs text-muted-foreground">
              默认 params（JSON）
              <Icon icon="lucide:braces" class="size-3.5" />
            </span>
            <textarea
              :value="paramsText"
              :disabled="readOnly"
              rows="4"
              spellcheck="false"
              class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              @input="onParamsInput"
            />
          </label>
          <label class="grid gap-1.5">
            <span class="flex items-center gap-1 text-xs text-muted-foreground">
              默认 query（JSON）
              <Icon icon="lucide:braces" class="size-3.5" />
            </span>
            <textarea
              :value="queryText"
              :disabled="readOnly"
              rows="4"
              spellcheck="false"
              class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              @input="onQueryInput"
            />
          </label>
        </div>
      </template>

      <template v-if="selected.type === 'EXTERNAL_LINK'">
        <Separator>外链</Separator>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="grid gap-1.5 sm:col-span-2">
            <span class="text-xs text-muted-foreground">HTTPS 外链</span>
            <Input
              :model-value="selected.href ?? ''"
              :disabled="readOnly"
              type="url"
              placeholder="https://…"
              @update:model-value="onHref"
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs text-muted-foreground">打开方式</span>
            <Select
              :model-value="selected.externalTarget ?? 'BLANK'"
              :items="externalTargetItems"
              :disabled="readOnly"
              class="w-full"
              @update:model-value="onExternalTarget"
            />
          </label>
        </div>
      </template>
    </div>
  </section>
</template>
