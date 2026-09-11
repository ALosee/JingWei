<script setup lang="ts">
import { breadcrumbVariants } from '#ui/styles/breadcrumb'
import { BreadcrumbCompact, provideBreadcrumbUi } from '@soybeanjs/headless/breadcrumb'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { BreadcrumbEmits, BreadcrumbProps, BreadcrumbSlots } from './types'

defineOptions({ name: 'SBreadcrumb' })

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
      <!-- @vue-ignore Headless owns the discriminated slot props. -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </BreadcrumbCompact>
</template>
