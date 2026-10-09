<script setup lang="ts">
import { collapsibleVariants } from '#ui/styles/collapsible'
import { CollapsibleRoot, provideCollapsibleUi } from '@vean/aria/collapsible'
import { useOmitProps } from '@vean/aria/composables'
import { computed } from 'vue'

import type { CollapsibleProps, CollapsibleEmits } from './types'

defineOptions({
  name: 'SCollapsible',
})

const props = withDefaults(defineProps<CollapsibleProps>(), {
  open: undefined,
  defaultOpen: false,
  unmountOnHide: true,
})

const emit = defineEmits<CollapsibleEmits>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])

const ui = computed(() => collapsibleVariants({ size: props.size }, props.ui))

provideCollapsibleUi(ui)
</script>

<template>
  <CollapsibleRoot
    v-slot="slotProps"
    v-bind="forwardedProps"
    @update:open="emit('update:open', $event)"
  >
    <slot v-bind="slotProps" />
  </CollapsibleRoot>
</template>
