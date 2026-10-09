<script setup lang="ts">
import { linkVariants } from '#ui/styles/link'
import { useOmitProps } from '@vean/aria/composables'
import { Link } from '@vean/aria/link'
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

const forwardedProps = useOmitProps(props, ['class'])

const cls = computed(() => linkVariants(undefined, props.class))
</script>

<template>
  <Link v-slot="slotProps" v-bind="forwardedProps" :class="cls">
    <slot v-bind="slotProps" />
  </Link>
</template>
