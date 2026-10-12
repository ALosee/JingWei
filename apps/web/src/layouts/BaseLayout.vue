<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { workspaceLogoPlacement } from '@jingwei/module-branding/shared'
import { AppShell } from '@jingwei/ui'

import { useLayoutStore } from '../stores/layout.js'
import GlobalBrand from './base/modules/global-brand/GlobalBrand.vue'
import GlobalToolbar from './base/modules/global-header/GlobalToolbar.vue'
import WorkspaceTabs from './base/modules/workspace-tabs/WorkspaceTabs.vue'
import { useWorkspaceNavigation } from './base/use-workspace-navigation.js'
import { useWorkspaceTabs } from './base/use-workspace-tabs.js'

const layout = useLayoutStore()
const { preferences, siderOpen } = storeToRefs(layout)
const isMobile = useMediaQuery('(max-width: 767.9px)')
const { items: tabs, activeValue: tabValue, beforeClose, menuFactory } = useWorkspaceTabs()
const pageRevision = ref(0)
const pageFullscreen = ref(false)
const mode = computed(() =>
  preferences.value.mode === 'left' ? 'sidebar' : preferences.value.mode,
)
const { items, activeValue, mobileOpen, menuProps, onSelect } = useWorkspaceNavigation()
const logoPlacement = computed(() => workspaceLogoPlacement(preferences.value.brandPlacement))
const layoutProps = computed(() => ({
  variant: preferences.value.sidebarVariant,
  ...(preferences.value.mode === 'left'
    ? { sidebarWidth: preferences.value.siderWidth, collapsedSidebarWidth: 64 }
    : {}),
  mobileSidebarWidth: Math.min(preferences.value.siderWidth, 320),
  headerHeight: preferences.value.headerHeight,
  tabVisible: pageFullscreen.value || preferences.value.showTabs,
  headerVisible: !pageFullscreen.value,
  fullContent: pageFullscreen.value,
  tabHeight: 40,
  footerVisible: false,
  scrollBehavior: 'content' as const,
  scrollId: 'workspace-content',
  fixedTop: true,
}))
</script>

<template>
  <AppShell
    v-model:open="siderOpen"
    v-model:mobile-open="mobileOpen"
    :mode="mode"
    :model-value="activeValue"
    :items="items"
    :logo-placement="logoPlacement"
    :is-mobile="isMobile"
    :layout-props="layoutProps"
    :menu-props="menuProps"
    :layout-ui="{
      rail: 'hidden',
      header: 'border-b border-border bg-card',
      tab: 'border-b border-border bg-card',
      content: 'min-w-0 overscroll-contain p-4',
      sidebarRoot: pageFullscreen ? '!hidden' : '',
    }"
    :ui="{ root: 'h-dvh min-h-0 overflow-hidden bg-background', tab: 'min-w-0 overflow-hidden' }"
    :menu-ui="{ treeNav: { overflow: 'min-w-0 w-full' } }"
    @select="onSelect"
  >
    <template #logo><GlobalBrand part="mark" /></template>
    <template #title><GlobalBrand part="title" /></template>
    <template #header-end><GlobalToolbar /></template>
    <template #tabs>
      <WorkspaceTabs
        v-model="tabValue"
        v-model:items="tabs"
        :before-close="beforeClose"
        :menu-factory="menuFactory"
        :fullscreen="pageFullscreen"
        @refresh="pageRevision++"
        @toggle-fullscreen="pageFullscreen = !pageFullscreen"
      />
    </template>
    <RouterView v-slot="{ Component }">
      <component :is="Component" :key="pageRevision" />
    </RouterView>
  </AppShell>
</template>
