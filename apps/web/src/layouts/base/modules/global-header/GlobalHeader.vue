<script setup lang="ts">
import { LayoutTrigger } from '@jingwei/ui'

import type { LayoutModeDefinition } from '../../layout-mode-registry.js'
import GlobalBrand from '../global-brand/GlobalBrand.vue'
import GlobalToolbar from './GlobalToolbar.vue'

defineProps<{
  definition: LayoutModeDefinition
  showBrand: boolean
  reserveBrandSpace: boolean
  brandCompact: boolean
}>()
</script>

<template>
  <div class="h-full w-full min-w-0 flex items-center">
    <div
      v-if="showBrand"
      data-global-brand-region="header"
      class="h-full flex shrink-0 items-center overflow-hidden"
      :class="reserveBrandSpace ? 'w-[--soybean-sidebar-width] px-4' : 'px-4'"
    >
      <GlobalBrand :compact="brandCompact" />
    </div>
    <div class="min-w-0 flex flex-1 items-center gap-3 px-4">
      <LayoutTrigger v-if="definition.sidebarVisible" />
      <component :is="definition.headerContextComponent" />
      <GlobalToolbar />
    </div>
  </div>
</template>
