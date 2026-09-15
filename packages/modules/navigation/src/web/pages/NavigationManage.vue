<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Icon, Tabs, toast } from '@jingwei/ui'

import type { NavigationNode, NavigationNodeType } from '../../shared/index.js'
import NavigationNodeForm from '../components/navigation-node-form.vue'
import NavigationPreviewPanel from '../components/navigation-preview-panel.vue'
import NavigationRoleGrantsPanel from '../components/navigation-role-grants-panel.vue'
import NavigationStructureTree from '../components/navigation-structure-tree.vue'
import NavigationValidationPanel from '../components/navigation-validation-panel.vue'
import NavigationVersionBar from '../components/navigation-version-bar.vue'
import { useNavigationManagement } from '../composables/use-navigation-management.js'

const { catalog, feedback, editor, versions, roles } = useNavigationManagement()
const { busy, message, error } = feedback
const {
  version,
  selectedId,
  selected,
  dirty,
  paramsText,
  queryText,
  search,
  highlightId,
  readOnly,
  rows,
  parentOptions,
  selectNode,
  changeType,
  changeRoute,
  addNodeAs,
  addSiblingNode,
  removeNode,
  moveNode,
  moveNodeToParent,
  toggleExpanded,
  expandAll,
  collapseAll,
  revealNode,
} = editor
const { admin, published, issues, selectVersion, newDraft, save, validate, publish, deleteDraft } =
  versions
const {
  roleId,
  loadedRoleId,
  grants,
  assignable,
  retiredCodes,
  previewCodesByRole,
  previewLoadingRoleId,
  ensurePreviewCodes,
  loadRole,
  saveGrants,
} = roles

const sideTab = ref<'preview' | 'grants' | 'validation'>('preview')
const sideTabs = [
  { value: 'preview', label: '预览' },
  { value: 'grants', label: '角色授权' },
  { value: 'validation', label: '校验' },
]

function onPreviewRoleId(id: string): void {
  if (!id) return
  void ensurePreviewCodes(id)
}

const internalOptions = computed(() =>
  (version.value?.nodes ?? [])
    .filter((node) => node.type === 'MENU' || node.type === 'PAGE')
    .map((node) => ({ code: node.code, label: `${node.name} · ${node.code}` })),
)

/** Login entry must be an enabled PUBLIC internal page (server NAVIGATION_AUTH_ENTRY_INVALID). */
const authEntryOptions = computed(() =>
  (version.value?.nodes ?? [])
    .filter(
      (node) =>
        (node.type === 'MENU' || node.type === 'PAGE') &&
        node.accessMode === 'PUBLIC' &&
        node.status === 'ENABLED',
    )
    .map((node) => ({ code: node.code, label: `${node.name} · ${node.code}` })),
)

const codeBaseline = ref(new Map<string, string>())
const dirtyCodeWarning = computed(() => {
  const node = selected.value
  if (node === undefined) return false
  const original = codeBaseline.value.get(node.id)
  return original !== undefined && original !== node.code
})

watch(
  () => version.value?.id,
  (id) => {
    if (id === undefined || version.value === null) {
      codeBaseline.value = new Map()
      return
    }
    codeBaseline.value = new Map(version.value.nodes.map((node) => [node.id, node.code]))
  },
  { immediate: true },
)

function onReveal(nodeId: string): void {
  revealNode(nodeId)
}

function onLocate(nodeId: string): void {
  revealNode(nodeId)
}

async function runSave(): Promise<void> {
  await save()
  if (feedback.error.value === '') {
    if (version.value !== null) {
      codeBaseline.value = new Map(version.value.nodes.map((node) => [node.id, node.code]))
    }
    toast.success('草稿已保存')
  }
}

async function runValidate(): Promise<void> {
  await validate()
  sideTab.value = 'validation'
  if (feedback.error.value === '') toast.success('校验通过')
}

async function runPublish(rollback: boolean): Promise<void> {
  await publish(rollback)
  if (feedback.error.value === '') toast.success(rollback ? '已回滚' : '导航已发布')
}

async function runDeleteDraft(): Promise<void> {
  await deleteDraft()
  if (feedback.error.value === '') toast.success('草稿已删除')
}

function addChild(type: NavigationNodeType): void {
  addNodeAs(type)
}

function onAddSibling(): void {
  addSiblingNode()
}

function onParamsUpdate(value: string): void {
  paramsText.value = value
  dirty.value = true
}

function onQueryUpdate(value: string): void {
  queryText.value = value
  dirty.value = true
}

function onUpdateRoleId(id: string): void {
  roleId.value = id
  void loadRole()
}

function onUpdateGrants(codes: string[]): void {
  grants.value = codes
}

function onUpdateAuthEntry(value: string): void {
  if (version.value === null) return
  version.value.authEntryCode = value
  dirty.value = true
}

function onUpdateHomeCode(value: string | null): void {
  if (version.value === null) return
  version.value.homeCode = value
  dirty.value = true
}

function onUpdateNode(patch: Partial<NavigationNode>): void {
  if (selected.value === undefined) return
  Object.assign(selected.value, patch)
  dirty.value = true
}

function onMarkDirty(): void {
  dirty.value = true
}

function onChangeType(type: NavigationNodeType): void {
  changeType(type)
}

function onChangeRoute(routeKey: string | null): void {
  changeRoute(routeKey)
}
</script>

<template>
  <div class="grid gap-4">
    <p
      v-if="error"
      role="alert"
      class="m-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      role="status"
      class="m-0 rounded-md border border-primary/20 bg-primary/8 px-3 py-2 text-sm text-foreground"
    >
      {{ message }}
    </p>

    <NavigationVersionBar
      :admin="admin"
      :version="version"
      :busy="busy"
      :read-only="readOnly"
      :dirty="dirty"
      :internal-options="internalOptions"
      :auth-entry-options="authEntryOptions"
      @select-version="selectVersion"
      @new-draft="newDraft"
      @save="runSave"
      @validate="runValidate"
      @publish="runPublish"
      @delete-draft="runDeleteDraft"
      @update-auth-entry="onUpdateAuthEntry"
      @update-home-code="onUpdateHomeCode"
    />

    <div
      class="grid gap-4 xl:grid-cols-[minmax(16rem,1.1fr)_minmax(18rem,1.4fr)_minmax(16rem,1fr)]"
    >
      <NavigationStructureTree
        :rows="rows"
        :selected-id="selectedId"
        :highlight-id="highlightId"
        :search="search"
        :read-only="readOnly"
        :busy="busy"
        @update-search="(value) => (search = value)"
        @select="selectNode"
        @toggle="toggleExpanded"
        @expand-all="expandAll"
        @collapse-all="collapseAll"
        @add-child="addChild"
        @add-sibling="onAddSibling"
        @remove="removeNode"
        @move="moveNode"
      />

      <NavigationNodeForm
        :selected="selected"
        :read-only="readOnly"
        :params-text="paramsText"
        :query-text="queryText"
        :route-options="catalog.routes"
        :parent-options="parentOptions"
        :dirty-code-warning="dirtyCodeWarning"
        @change-type="onChangeType"
        @change-route="onChangeRoute"
        @change-parent="moveNodeToParent"
        @update-node="onUpdateNode"
        @update-params-text="onParamsUpdate"
        @update-query-text="onQueryUpdate"
        @mark-dirty="onMarkDirty"
      />

      <section class="flex min-h-0 flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
        <Tabs v-model="sideTab" :items="sideTabs" size="sm" fill="full">
          <template #content="{ value }">
            <div class="min-w-0 pt-2">
              <NavigationPreviewPanel
                v-if="value === 'preview'"
                :nodes="version?.nodes ?? []"
                :roles="catalog.roles"
                :granted-codes-by-role="previewCodesByRole"
                :loading-role-id="previewLoadingRoleId"
                @reveal="onReveal"
                @update-role-id="onPreviewRoleId"
              />
              <NavigationRoleGrantsPanel
                v-else-if="value === 'grants'"
                :roles="catalog.roles"
                :role-id="roleId"
                :loaded-role-id="loadedRoleId"
                :grants="grants"
                :assignable="assignable"
                :retired-codes="retiredCodes"
                :busy="busy"
                @update-role-id="onUpdateRoleId"
                @load-role="loadRole"
                @update-grants="onUpdateGrants"
                @save="saveGrants"
              />
              <NavigationValidationPanel v-else :issues="issues" @locate="onLocate" />
            </div>
          </template>
        </Tabs>

        <p v-if="published" class="m-0 flex items-center gap-1 text-xs text-muted-foreground">
          <Icon icon="lucide:radio" class="size-3.5" />
          当前线上为 V{{ published.revision }}，普通用户不会看到未发布草稿的改动。
        </p>
      </section>
    </div>
  </div>
</template>
