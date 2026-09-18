<script setup lang="ts">
import { computed } from 'vue'

import type { LogoColorMode } from '../../shared/index.js'

const props = defineProps<{
  src: string
  colorMode: LogoColorMode
}>()

const maskStyle = computed(() => {
  const value = `url("${props.src}")`
  return {
    maskImage: value,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskImage: value,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
  }
})
</script>

<template>
  <span
    v-if="colorMode === 'FOLLOW_THEME'"
    aria-hidden="true"
    class="inline-block shrink-0 bg-current"
    :style="maskStyle"
  />
  <img v-else :src="src" alt="" aria-hidden="true" />
</template>
