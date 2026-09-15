<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button, Segment, Select } from '@jingwei/ui'
import type { SegmentOptionData, SelectSingleOptionData } from '@jingwei/ui'

import type { NavigationNode } from '../../shared/index.js'
import {
  projectSidebarPreview,
  type PreviewPerspective,
} from '../composables/navigation-preview.js'
import NavigationPreviewTreeItem from './navigation-preview-tree-item.vue'

const emit = defineEmits<{
  reveal: [nodeId: string]
  updateRoleId: [id: string]
}>()

const props = defineProps<{
  nodes: readonly NavigationNode[]
  roles: { id: string; code: string; name: string }[]
  grantedCodesByRole: ReadonlyMap<string, ReadonlySet<string>>
  loadingRoleId: string
}>()

const perspective = ref<PreviewPerspective>('authenticated')
const roleId = ref('')

const perspectiveItems: SegmentOptionData<PreviewPerspective>[] = [
  { value: 'public', label: '匿名' },
  { value: 'authenticated', label: '登录用户' },
  { value: 'role', label: '按角色' },
]

const NONE = '__none__'

const roleItems = computed<SelectSingleOptionData<string>[]>(() => [
  { value: NONE, label: '选择角色（使用已保存授权）' },
  ...props.roles.map((role) => ({ value: role.id, label: `${role.name} · ${role.code}` })),
])

const codesReady = computed(() => roleId.value !== '' && props.grantedCodesByRole.has(roleId.value))
const loading = computed(() => props.loadingRoleId !== '' && props.loadingRoleId === roleId.value)

const projected = computed(() => {
  if (perspective.value === 'role') {
    if (roleId.value === '' || roleId.value === NONE || !codesReady.value) return []
    return projectSidebarPreview(
      props.nodes,
      'role',
      props.grantedCodesByRole.get(roleId.value) ?? new Set(),
    )
  }
  return projectSidebarPreview(props.nodes, perspective.value)
})

function onRoleIdChange(value: unknown): void {
  const next = typeof value === 'string' && value !== NONE ? value : ''
  roleId.value = next
  emit('updateRoleId', next)
}

const sidebarNodes = computed(() => projected.value.filter((node) => node.type !== 'PAGE'))
const hiddenPages = computed(() => projected.value.filter((node) => node.type === 'PAGE'))

const byParent = computed(() => {
  const map = new Map<string | null, NavigationNode[]>()
  for (const node of sidebarNodes.value) {
    const bucket = map.get(node.parentId)
    if (bucket === undefined) map.set(node.parentId, [node])
    else bucket.push(node)
  }
  return map
})

const roots = computed(() => byParent.value.get(null) ?? [])

function hint(): string {
  if (perspective.value === 'public') return '匿名 bootstrap 只会投影 PUBLIC 节点及必要容器。'
  if (perspective.value === 'authenticated')
    return '登录用户可见 PUBLIC + AUTHENTICATED；PERMISSION 节点仍按角色授权过滤。'
  if (roleId.value === '' || roleId.value === NONE)
    return '选择角色后，使用已保存的 code grant 模拟侧栏。'
  if (loading.value) return '正在加载该角色的导航授权…'
  if (!codesReady.value) return '未能加载该角色授权，请重试。'
  return '仅展示该角色获授 code 的 PERMISSION 节点，以及 PUBLIC/AUTHENTICATED 节点。'
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <header>
      <h2 class="m-0 text-sm font-semibold text-foreground">侧栏预览</h2>
      <p class="mb-0 mt-1 text-xs text-muted-foreground">{{ hint() }}</p>
    </header>

    <Segment v-model="perspective" :items="perspectiveItems" size="sm" class="w-full" />

    <Select
      v-if="perspective === 'role'"
      :model-value="roleId === '' ? NONE : roleId"
      :items="roleItems"
      class="w-full"
      @update:model-value="onRoleIdChange"
    />

    <div class="max-h-72 overflow-auto rounded-md border border-border bg-background/50 p-2">
      <p
        v-if="sidebarNodes.length === 0"
        class="m-0 px-2 py-4 text-center text-sm text-muted-foreground"
      >
        该视角下侧栏为空。
      </p>
      <ul v-else class="m-0 list-none p-0">
        <NavigationPreviewTreeItem
          v-for="node in roots"
          :key="node.id"
          :node="node"
          :children="byParent.get(node.id) ?? []"
          :child-map="byParent"
          :depth="0"
          @reveal="(id) => emit('reveal', id)"
        />
      </ul>
    </div>

    <div v-if="hiddenPages.length > 0" class="text-xs text-muted-foreground">
      <p class="m-0 mb-1 font-medium">投影中的隐藏 PAGE（不进侧栏）</p>
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="page in hiddenPages"
          :key="page.id"
          size="sm"
          variant="ghost"
          class="h-6 px-2 text-[0.7rem]"
          @click="emit('reveal', page.id)"
        >
          {{ page.name }}
        </Button>
      </div>
    </div>
  </section>
</template>
