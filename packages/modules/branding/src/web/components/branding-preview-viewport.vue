<script setup lang="ts">
import { useBrandPreviewViewport } from '../composables/use-brand-preview-viewport.js'

const { container, containerStyle, canvasStyle } = useBrandPreviewViewport(960, 560)
</script>

<template>
  <div
    ref="container"
    class="relative w-full min-w-0 overflow-hidden"
    :style="containerStyle"
    data-brand-preview-viewport
  >
    <div class="absolute inset-0 origin-top-left" :style="canvasStyle" inert><slot /></div>
  </div>
</template>
