<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { Layout } from '@jingwei/ui'

import { useLayoutStore } from '../stores/layout.js'
import { getLayoutModeDefinition, type LayoutModeContext } from './base/layout-mode-registry.js'
import { layoutTargetIds } from './base/layout-targets.js'
import GlobalBrand from './base/modules/global-brand/GlobalBrand.vue'
import GlobalHeader from './base/modules/global-header/GlobalHeader.vue'
import GlobalPageTabs from './base/modules/global-tab/GlobalPageTabs.vue'

const layout = useLayoutStore()
const { preferences, siderOpen } = storeToRefs(layout)
const isMobile = useMediaQuery('(max-width: 767px)')
const modeDefinition = computed(() => getLayoutModeDefinition(preferences.value.mode))
const modeContext = computed<LayoutModeContext>(() => ({
  preferences: preferences.value,
  isMobile: isMobile.value,
}))
const orientation = computed(() => modeDefinition.value.orientation(modeContext.value))
const showHeaderBrand = computed(() => modeDefinition.value.showHeaderBrand(modeContext.value))
const showSiderBrand = computed(() => modeDefinition.value.showSiderBrand(modeContext.value))
const reserveHeaderBrandSpace = computed(
  () => showHeaderBrand.value && modeDefinition.value.sidebarVisible && !isMobile.value,
)
const compactHeaderBrand = computed(() => isMobile.value)
const layoutUi = {
  root: 'h-dvh min-h-0 overflow-hidden bg-background',
  sidebarWrapper: 'border-sidebar-border',
  sidebar: 'text-sidebar-foreground',
  rail: 'hidden',
  header: 'border-b border-border bg-card',
  tab: 'bg-card',
  content: 'min-w-0 overscroll-contain p-4',
} as const
</script>

<template>
  <Layout
    v-model:open="siderOpen"
    :ui="layoutUi"
    :orientation="orientation"
    :sidebar-visible="modeDefinition.sidebarVisible"
    :sidebar-width="preferences.siderWidth"
    :collapsed-sidebar-width="64"
    :is-mobile="isMobile"
    :mobile-sidebar-width="Math.min(preferences.siderWidth, 320)"
    :header-height="preferences.headerHeight"
    :tab-visible="preferences.showTabs"
    :tab-height="40"
    :footer-visible="false"
    scroll-behavior="content"
    scroll-id="workspace-content"
    collapsible="icon"
    fixed-top
  >
    <template #sidebar>
      <div class="min-h-0 flex flex-1 flex-col">
        <div
          v-if="showSiderBrand"
          data-global-brand-region="sider"
          class="h-[var(--soybean-layout-header-height)] flex shrink-0 items-center overflow-hidden pl-4"
        >
          <GlobalBrand :compact="preferences.siderCollapsed" />
        </div>
        <div :id="layoutTargetIds.siderMenu" class="min-h-0 flex-1" />
      </div>
    </template>

    <template #header>
      <GlobalHeader
        :definition="modeDefinition"
        :show-brand="showHeaderBrand"
        :reserve-brand-space="reserveHeaderBrandSpace"
        :brand-compact="compactHeaderBrand"
      />
    </template>

    <template #tab>
      <GlobalPageTabs />
    </template>

    <RouterView />
  </Layout>

  <component :is="modeDefinition.menuComponent" />
</template>
