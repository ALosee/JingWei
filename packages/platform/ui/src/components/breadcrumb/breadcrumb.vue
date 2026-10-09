<script setup lang="ts" generic="T extends BreadcrumbOptionData = BreadcrumbOptionData">
import { breadcrumbVariants } from '#ui/styles/breadcrumb'
import { BreadcrumbCompact, provideBreadcrumbUi } from '@vean/aria/breadcrumb'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { keysOf } from '@vean/aria/shared'
import { computed } from 'vue'

import type {
  BreadcrumbProps,
  BreadcrumbEmits,
  BreadcrumbOptionData,
  BreadcrumbSlots,
} from './types'

defineOptions({
  name: 'SBreadcrumb',
})

const props = defineProps<BreadcrumbProps>()

const emit = defineEmits<BreadcrumbEmits>()

const slots = defineSlots<BreadcrumbSlots>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots))

const ui = computed(() => breadcrumbVariants({ size: props.size }, props.ui, { root: props.class }))

provideBreadcrumbUi(ui)
</script>

<template>
  <BreadcrumbCompact v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" #[slotName]="slotProps">
      <!-- @vue-ignore ignore vue slot props type -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </BreadcrumbCompact>
</template>
