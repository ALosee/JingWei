<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { workspaceLogoPlacement } from '@jingwei/module-branding/shared'
import { AppShell } from '@jingwei/ui'

import { useLayoutStore } from '../stores/layout.js'
import GlobalBrand from './base/modules/global-brand/GlobalBrand.vue'
import GlobalToolbar from './base/modules/global-header/GlobalToolbar.vue'
import { useWorkspaceNavigation } from './base/use-workspace-navigation.js'
import { useWorkspaceTabs } from './base/use-workspace-tabs.js'

const layout = useLayoutStore()
const { preferences, siderOpen } = storeToRefs(layout)
const isMobile = useMediaQuery('(max-width: 767.9px)')
const { items: tabs, activeValue: tabValue, beforeClose, onClose } = useWorkspaceTabs()
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
  tabVisible: preferences.value.showTabs,
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
    v-model:tabs="tabs"
    v-model:tab-value="tabValue"
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
    }"
    :ui="{ root: 'h-dvh min-h-0 overflow-hidden bg-background', tab: 'overflow-x-auto' }"
    :menu-ui="{ treeNav: { overflow: 'min-w-0 w-full' } }"
    :tab-props="{ beforeClose, middleClickClose: true }"
    :tab-ui="{ root: 'h-full min-w-max items-end px-2', item: 'h-8' }"
    @tab-close="onClose"
    @select="onSelect"
  >
    <template #logo><GlobalBrand part="mark" /></template>
    <template #title><GlobalBrand part="title" /></template>
    <template #header-end><GlobalToolbar /></template>
    <RouterView />
  </AppShell>
</template>
