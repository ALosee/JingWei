<script setup lang="ts">
import { computed } from 'vue'

import type { WorkspaceLayoutMode } from '@jingwei/module-branding/shared'

const props = defineProps<{ mode: WorkspaceLayoutMode }>()
interface Region {
  name: string
  x: number
  y: number
  width: number
  height: number
  content?: boolean
}
const regions: Record<WorkspaceLayoutMode, Region[]> = {
  left: [
    { name: 'sidebar', x: 0, y: 0, width: 44, height: 96 },
    { name: 'header', x: 48, y: 0, width: 112, height: 24 },
    { name: 'content', x: 48, y: 28, width: 112, height: 68, content: true },
  ],
  top: [
    { name: 'header', x: 0, y: 0, width: 160, height: 24 },
    { name: 'content', x: 0, y: 28, width: 160, height: 68, content: true },
  ],
  'dual-vertical': [
    { name: 'rail', x: 0, y: 0, width: 20, height: 96 },
    { name: 'sidebar', x: 24, y: 0, width: 36, height: 96 },
    { name: 'header', x: 64, y: 0, width: 96, height: 24 },
    { name: 'content', x: 64, y: 28, width: 96, height: 68, content: true },
  ],
  'vertical-horizontal': [
    { name: 'rail', x: 0, y: 0, width: 20, height: 96 },
    { name: 'header', x: 24, y: 0, width: 136, height: 24 },
    { name: 'content', x: 24, y: 28, width: 136, height: 68, content: true },
  ],
  'horizontal-vertical': [
    { name: 'header', x: 0, y: 0, width: 160, height: 24 },
    { name: 'sidebar', x: 0, y: 28, width: 44, height: 68 },
    { name: 'content', x: 48, y: 28, width: 112, height: 68, content: true },
  ],
  'horizontal-dual-vertical': [
    { name: 'header', x: 0, y: 0, width: 160, height: 24 },
    { name: 'rail', x: 0, y: 28, width: 20, height: 68 },
    { name: 'sidebar', x: 24, y: 28, width: 36, height: 68 },
    { name: 'content', x: 64, y: 28, width: 96, height: 68, content: true },
  ],
}
const drawing = computed(() => regions[props.mode])
</script>

<template>
  <svg
    :data-layout-mode-preview="mode"
    viewBox="0 0 160 96"
    preserveAspectRatio="none"
    class="size-full text-primary"
    aria-hidden="true"
  >
    <rect
      v-for="region in drawing"
      :key="region.name"
      :data-layout-region="region.name"
      :x="region.x"
      :y="region.y"
      :width="region.width"
      :height="region.height"
      rx="3"
      fill="currentColor"
      :fill-opacity="region.content ? 0.3 : 0.8"
    />
  </svg>
</template>
