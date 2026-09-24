<script setup lang="ts">
import { splitterVariants } from '#ui/styles/splitter'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { SplitterGroup, provideSplitterUi } from '@soybeanjs/headless/splitter'
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
