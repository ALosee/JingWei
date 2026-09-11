<script setup lang="ts">
import { LayoutTrigger } from '@jingwei/ui'

import type { LayoutModeDefinition } from '../../layout-mode-registry.js'
import GlobalBrand from '../global-brand/GlobalBrand.vue'
import GlobalToolbar from './GlobalToolbar.vue'

defineProps<{
  definition: LayoutModeDefinition
  showBrand: boolean
}>()
</script>

<template>
  <div class="h-full w-full min-w-0 flex items-center gap-3">
    <GlobalBrand v-if="showBrand" />
    <LayoutTrigger v-if="definition.sidebarVisible" />
    <component :is="definition.headerContextComponent" />
    <GlobalToolbar />
  </div>
</template>
