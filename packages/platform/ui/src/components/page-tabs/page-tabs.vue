<script setup lang="ts">
import { menuVariants } from '#ui/styles/menu'
import { pageTabsVariants } from '#ui/styles/page-tabs'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { provideMenuUi } from '@soybeanjs/headless/menu'
import { PageTabsCompact, providePageTabsUi } from '@soybeanjs/headless/page-tabs'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { PageTabsEmits, PageTabsProps, PageTabsSlots } from './types'

defineOptions({ name: 'SPageTabs' })

const props = withDefaults(defineProps<PageTabsProps>(), { variant: 'chrome', loop: true })
const emit = defineEmits<PageTabsEmits>()
const slots = defineSlots<PageTabsSlots>()
const forwardedProps = useOmitProps(props, [
  'class',
  'size',
  'variant',
  'ui',
  'onClick',
  'onContextmenu',
])
const listeners = useForwardListeners(emit)
const slotNames = computed(() => keysOf(slots).filter((name) => name !== 'indicator'))
const ui = computed(() =>
  pageTabsVariants({ size: props.size, variant: props.variant }, props.ui, { root: props.class }),
)
const menuUi = computed(() => menuVariants({ size: props.size }))

provideMenuUi(menuUi)
providePageTabsUi(ui)
</script>

<template>
  <PageTabsCompact v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" #[slotName]="slotProps">
      <!-- @vue-ignore Headless owns the discriminated slot props. -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
    <template #indicator>
      <template v-if="variant === 'chrome'">
        <svg height="100%" width="100%" viewBox="0 0 8 8" :class="ui.chromeBgLeft">
          <path d="M 0 8 A 8 8 0 0 0 8 0 L 8 8 Z" />
        </svg>
        <svg height="100%" width="100%" viewBox="0 0 8 8" :class="ui.chromeBgRight">
          <path d="M 0 0 A 8 8 0 0 0 8 8 L 0 8 Z" />
        </svg>
      </template>
      <div v-if="variant === 'slider'" :class="ui.sliderIndicator" />
    </template>
  </PageTabsCompact>
</template>
