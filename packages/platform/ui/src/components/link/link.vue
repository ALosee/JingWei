<script setup lang="ts">
import { linkVariants } from '#ui/styles/link'
import { Link } from '@soybeanjs/headless/link'
import { computed } from 'vue'

import type { LinkProps } from './types'

defineOptions({
  name: 'SLink',
})

const props = withDefaults(defineProps<LinkProps>(), {
  disabled: undefined,
  external: undefined,
  noRel: undefined,
  prefetch: undefined,
  noPrefetch: undefined,
  viewTransition: undefined,
  replace: undefined,
})

const cls = computed(() => linkVariants(undefined, props.class))
</script>

<template>
  <Link v-slot="slotProps" v-bind="props" :class="cls">
    <slot v-bind="slotProps" />
  </Link>
</template>
