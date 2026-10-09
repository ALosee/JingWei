<script setup lang="ts">
import { splitterVariants } from '#ui/styles/splitter'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { SplitterGroup, provideSplitterUi } from '@vean/aria/splitter'
import { computed } from 'vue'

import type { SplitterGroupProps, SplitterGroupEmits } from './types'

defineOptions({
  name: 'SSplitterGroup',
})

const props = defineProps<SplitterGroupProps>()

const emit = defineEmits<SplitterGroupEmits>()

const forwardedProps = useOmitProps(props, ['class', 'ui'])

const listeners = useForwardListeners(emit)

const ui = computed(() => splitterVariants({ size: props.size }, props.ui, { root: props.class }))

provideSplitterUi(ui)
</script>

<template>
  <SplitterGroup v-bind="forwardedProps" v-on="listeners">
    <slot />
  </SplitterGroup>
</template>
